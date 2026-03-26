import { Queue, Worker } from 'bullmq'
import { getRedis } from '../../lib/redis.js'
import { prisma } from '../../lib/prisma.js'
import { triggersRepository } from './triggers.repository.js'
import { taskOrchestrator } from '../execution/orchestrator/task-orchestrator.js'
import { isDAGWorkflow } from '../execution/orchestrator/dag-executor.js'
import { getMaxConcurrency } from '../execution/orchestrator/orchestrator-utils.js'
import { conversationsRepository } from '../conversations/conversations.repository.js'

const PROJECT_BASE_PATH = process.env.PROJECT_BASE_PATH || '/workspace/temp-orquestrador'

const QUEUE_NAME = 'trigger-scheduler'
const POLL_INTERVAL_MS = 30_000 // 30s

let _queue: Queue | null = null
let _worker: Worker | null = null

export function startTriggerScheduler(): void {
  if (_worker) return

  try {
    const connection = getRedis() as any

    _queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      },
    })

    // Add repeatable job that polls every 30s
    _queue.add('poll', {}, {
      repeat: { every: POLL_INTERVAL_MS },
      jobId: 'trigger-poll',
    }).catch(err => {
      console.error('[TriggerScheduler] Failed to add repeatable job:', err.message)
    })

    _worker = new Worker(
      QUEUE_NAME,
      async () => { await processScheduledExecutions() },
      { connection, concurrency: 1 }
    )

    _worker.on('failed', (_job, err) => {
      console.error('[TriggerScheduler] Poll failed:', err.message)
    })

    _worker.on('error', (err) => {
      console.error('[TriggerScheduler] Worker error:', err.message)
    })

    console.log(`[TriggerScheduler] Started (polling every ${POLL_INTERVAL_MS / 1000}s)`)
  } catch (err) {
    console.warn('[TriggerScheduler] Failed to start (Redis unavailable):', (err as Error).message)
    _worker = null
    _queue = null
  }
}

export async function stopTriggerScheduler(): Promise<void> {
  if (_worker) {
    await _worker.close()
    _worker = null
  }
  if (_queue) {
    await _queue.obliterate({ force: true }).catch(() => {})
    await _queue.close()
    _queue = null
  }
  console.log('[TriggerScheduler] Stopped')
}

async function processScheduledExecutions(): Promise<void> {
  const due = await triggersRepository.findDueScheduled()
  if (due.length === 0) return

  console.log(`[TriggerScheduler] Processing ${due.length} due scheduled executions`)

  for (const scheduled of due) {
    try {
      // Mark as running
      await triggersRepository.updateScheduledStatus(scheduled.id, 'running', {
        executedAt: new Date(),
      })

      // Update trigger's lastTriggeredAt
      await prisma.workflowTrigger.update({
        where: { id: scheduled.triggerId },
        data: { lastTriggeredAt: new Date() },
      })

      // Check rate limit
      if (scheduled.trigger.rateLimit) {
        const recentCount = await countRecentTriggers(scheduled.triggerId, scheduled.trigger.rateLimit)
        if (recentCount >= scheduled.trigger.rateLimit) {
          await triggersRepository.updateScheduledStatus(scheduled.id, 'failed', {
            errorMessage: `Rate limit exceeded (${scheduled.trigger.rateLimit}/hour)`,
          })
          continue
        }
      }

      // Execute the workflow
      await executeTriggeredWorkflow(scheduled)

      // Schedule next cron execution if trigger is cron type
      if (scheduled.trigger.type === 'cron' && scheduled.trigger.cronExpr && scheduled.trigger.enabled) {
        const { triggersService } = await import('./triggers.service.js')
        await triggersService.scheduleCron(scheduled.triggerId)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[TriggerScheduler] Execution ${scheduled.id} failed:`, errorMessage)
      await triggersRepository.updateScheduledStatus(scheduled.id, 'failed', { errorMessage })
    }
  }
}

async function executeTriggeredWorkflow(scheduled: Awaited<ReturnType<typeof triggersRepository.findDueScheduled>>[0]): Promise<void> {
  const workflow = scheduled.trigger.workflow
  const userId = workflow.userId

  // Fetch workflow with steps
  const fullWorkflow = await prisma.workflow.findUnique({
    where: { id: workflow.id },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  })

  if (!fullWorkflow || fullWorkflow.steps.length === 0) {
    await triggersRepository.updateScheduledStatus(scheduled.id, 'failed', {
      errorMessage: 'Workflow not found or has no steps',
    })
    return
  }

  // Create a new conversation for this triggered execution
  const conversation = await conversationsRepository.create(
    {
      workflowId: workflow.id,
      title: `[Trigger] ${workflow.name} - ${new Date().toLocaleString('pt-BR')}`,
      projectPath: PROJECT_BASE_PATH,
    },
    userId,
  )

  if (!conversation) {
    await triggersRepository.updateScheduledStatus(scheduled.id, 'failed', {
      errorMessage: 'Failed to create conversation for triggered execution',
    })
    return
  }

  const triggerMessage = buildTriggerMessage(scheduled.trigger.type, scheduled.trigger.eventName)

  const context = {
    conversationId: conversation.id,
    workflowId: workflow.id,
    steps: fullWorkflow.steps,
    projectPath: conversation.projectPath || PROJECT_BASE_PATH,
    userId,
    maxConcurrency: getMaxConcurrency(fullWorkflow.config),
  }

  // Execute based on workflow type
  try {
    if (fullWorkflow.type === 'sequential' && isDAGWorkflow(fullWorkflow.steps)) {
      await taskOrchestrator.executeDAG(context, triggerMessage)
    } else if (fullWorkflow.type === 'sequential') {
      await taskOrchestrator.executeSequential(context, triggerMessage)
    } else {
      await taskOrchestrator.executeStepByStep(context, triggerMessage, 0)
    }

    await triggersRepository.updateScheduledStatus(scheduled.id, 'completed', {
      result: { conversationId: conversation.id, message: 'Workflow execution started' },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    await triggersRepository.updateScheduledStatus(scheduled.id, 'failed', {
      errorMessage: `Workflow execution failed: ${errorMessage}`,
      result: { conversationId: conversation.id },
    })
  }
}

function buildTriggerMessage(triggerType: string, eventName?: string | null): string {
  switch (triggerType) {
    case 'cron':
      return 'Execução agendada via cron trigger. Execute o workflow conforme configurado.'
    case 'webhook_inbound':
      return 'Execução disparada via webhook inbound. Execute o workflow conforme configurado.'
    case 'event':
      return `Execução disparada pelo evento "${eventName || 'unknown'}". Execute o workflow conforme configurado.`
    case 'git_push':
      return 'Execução disparada por git push. Execute o workflow conforme configurado.'
    default:
      return 'Execução disparada manualmente via trigger. Execute o workflow conforme configurado.'
  }
}

async function countRecentTriggers(triggerId: string, _rateLimit: number): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  return prisma.scheduledExecution.count({
    where: {
      triggerId,
      executedAt: { gte: oneHourAgo },
      status: { in: ['completed', 'running'] },
    },
  })
}
