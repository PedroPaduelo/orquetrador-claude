import { triggersRepository } from './triggers.repository.js'
import { prisma } from '../../lib/prisma.js'

function parseNextCron(cronExpr: string, _timezone?: string | null): Date | null {
  // Simple next-execution calculator for standard 5-field cron
  // For production, consider using a library like cron-parser
  try {
    const now = new Date()
    const parts = cronExpr.trim().split(/\s+/)
    if (parts.length !== 5) return null

    const [minPart, hourPart, , ,] = parts
    const minute = minPart === '*' ? now.getMinutes() + 1 : parseInt(minPart, 10)
    const hour = hourPart === '*' ? now.getHours() : parseInt(hourPart, 10)

    const next = new Date(now)
    next.setSeconds(0, 0)
    next.setMinutes(minute)
    next.setHours(hour)

    if (next <= now) {
      next.setDate(next.getDate() + 1)
    }
    return next
  } catch {
    return null
  }
}

export const triggersService = {
  async scheduleCron(triggerId: string) {
    const trigger = await prisma.workflowTrigger.findUnique({ where: { id: triggerId } })
    if (!trigger || trigger.type !== 'cron' || !trigger.cronExpr) return null

    const nextRun = parseNextCron(trigger.cronExpr, trigger.cronTimezone)
    if (!nextRun) return null

    return triggersRepository.createScheduledExecution(triggerId, nextRun)
  },

  async processScheduledExecutions() {
    const due = await triggersRepository.findDueScheduled()
    const results: Array<{ id: string; status: string }> = []

    for (const scheduled of due) {
      try {
        await triggersRepository.updateScheduledStatus(scheduled.id, 'running', {
          executedAt: new Date(),
        })

        await prisma.workflowTrigger.update({
          where: { id: scheduled.triggerId },
          data: { lastTriggeredAt: new Date() },
        })

        // TODO: integrate with actual workflow execution engine
        // For now, mark as completed
        await triggersRepository.updateScheduledStatus(scheduled.id, 'completed', {
          result: { message: 'Execution triggered successfully' },
        })

        results.push({ id: scheduled.id, status: 'completed' })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        await triggersRepository.updateScheduledStatus(scheduled.id, 'failed', {
          errorMessage,
        })
        results.push({ id: scheduled.id, status: 'failed' })
      }
    }

    return results
  },

  async cancelScheduled(triggerId: string) {
    const result = await triggersRepository.cancelPendingByTrigger(triggerId)
    return { cancelled: result.count }
  },

  async fireNow(triggerId: string) {
    const now = new Date()
    await prisma.workflowTrigger.update({
      where: { id: triggerId },
      data: { lastTriggeredAt: now },
    })
    return triggersRepository.createScheduledExecution(triggerId, now)
  },
}
