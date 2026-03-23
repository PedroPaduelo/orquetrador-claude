import { prisma } from '../../../lib/prisma.js'
import { StreamParser } from '../engine/claude/stream-parser.js'

interface CompactEvent {
  t: number
  k: string
  d?: { type?: string; name?: string; msg?: string } & Record<string, unknown>
}

interface ToolCallPair {
  toolName: string
  input: unknown
  output: unknown
  durationMs: number | null
  success: boolean
  errorMessage: string | null
}

function extractPairsFromStdout(stdoutRaw: string): ToolCallPair[] {
  const parser = new StreamParser()
  const events = parser.parse(stdoutRaw + '\n')
  const pairs: ToolCallPair[] = []

  const pendingToolUses = new Map<string, { name: string; input: unknown; timestamp: number }>()

  for (const event of events) {
    if (event.type !== 'action' || !event.action) continue

    const action = event.action

    if (action.type === 'tool_use' && action.id && action.name) {
      pendingToolUses.set(action.id, {
        name: action.name,
        input: action.input ?? {},
        timestamp: Date.now(),
      })
    }

    if (action.type === 'tool_result' && action.id) {
      const toolUse = pendingToolUses.get(action.id)
      const isError = typeof action.output === 'string' && action.output.includes('Error')

      pairs.push({
        toolName: toolUse?.name ?? action.name ?? 'unknown',
        input: toolUse?.input ?? {},
        output: action.output ?? null,
        durationMs: null,
        success: !isError,
        errorMessage: isError ? String(action.output).substring(0, 500) : null,
      })

      if (action.id) pendingToolUses.delete(action.id)
    }
  }

  // Tool uses sem result (interrupted, etc.)
  for (const [, pending] of pendingToolUses) {
    pairs.push({
      toolName: pending.name,
      input: pending.input,
      output: null,
      durationMs: null,
      success: false,
      errorMessage: 'No tool_result received',
    })
  }

  return pairs
}

function extractPairsFromCompactEvents(events: CompactEvent[]): ToolCallPair[] {
  const pairs: ToolCallPair[] = []
  const pendingToolUses: Array<{ name: string; timestamp: number }> = []

  for (const event of events) {
    if (event.k !== 'action' || !event.d) continue

    if (event.d.type === 'tool_use' && event.d.name) {
      pendingToolUses.push({ name: event.d.name, timestamp: event.t })
    }

    if (event.d.type === 'tool_result') {
      const toolUse = pendingToolUses.shift()
      const durationMs = toolUse ? event.t - toolUse.timestamp : null

      pairs.push({
        toolName: toolUse?.name ?? event.d.name ?? 'unknown',
        input: {},
        output: null,
        durationMs,
        success: true,
        errorMessage: null,
      })
    }
  }

  for (const pending of pendingToolUses) {
    pairs.push({
      toolName: pending.name,
      input: {},
      output: null,
      durationMs: null,
      success: false,
      errorMessage: 'No tool_result received',
    })
  }

  return pairs
}

export async function extractToolCalls(traceId: string): Promise<number> {
  const trace = await prisma.executionTrace.findUnique({
    where: { id: traceId },
    select: { id: true, stdoutRaw: true, parsedEvents: true },
  })

  if (!trace) return 0

  // Prefer stdoutRaw (has full input/output), fallback to compact events
  let pairs: ToolCallPair[]

  if (trace.stdoutRaw && trace.stdoutRaw.length > 0) {
    pairs = extractPairsFromStdout(trace.stdoutRaw)
  } else {
    const events = (trace.parsedEvents ?? []) as unknown as CompactEvent[]
    pairs = extractPairsFromCompactEvents(events)
  }

  if (pairs.length === 0) return 0

  await prisma.executionToolCall.createMany({
    data: pairs.map(p => ({
      traceId,
      toolName: p.toolName,
      input: p.input as any,
      output: p.output as any,
      durationMs: p.durationMs,
      success: p.success,
      errorMessage: p.errorMessage,
    })),
  })

  return pairs.length
}

export async function extractToolCallsForExecution(executionId: string): Promise<number> {
  const traces = await prisma.executionTrace.findMany({
    where: { executionId },
    select: { id: true },
  })

  let total = 0
  for (const trace of traces) {
    total += await extractToolCalls(trace.id)
  }
  return total
}
