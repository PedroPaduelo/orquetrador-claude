import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

const convId = 'f281b556-1332-44a0-b20f-b1e45b20459c'

const traces = await p.executionTrace.findMany({
  where: { conversationId: convId },
  orderBy: { createdAt: 'desc' },
  take: 5,
})

for (const t of traces) {
  console.log('=== Trace', t.id, '===')
  console.log('StepId:', t.stepId)
  console.log('Status:', t.resultStatus)
  console.log('Error:', t.errorMessage)
  console.log('ExitCode:', t.exitCode)
  console.log('Signal:', t.signal)
  console.log('Duration:', t.durationMs, 'ms')
  console.log('ContentLength:', t.contentLength)
  console.log('StopReason:', t.stopReason)
  console.log('NumTurns:', t.numTurns)
  console.log('Model:', t.model)
  console.log('CreatedAt:', t.createdAt)

  // Check for system.init and result events
  if (t.stdoutRaw) {
    const lines = t.stdoutRaw.split('\n')
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        if (parsed.type === 'system' && parsed.subtype === 'init') {
          console.log('Tools count:', parsed.tools?.length)
          const mcpTools = parsed.tools?.filter(t => t.startsWith('mcp__')) || []
          console.log('MCP tools:', mcpTools.join(', '))
          if (parsed.mcp_servers) {
            for (const srv of parsed.mcp_servers) {
              console.log(`  MCP: ${srv.name} = ${srv.status}`)
            }
          }
        }
        if (parsed.type === 'result') {
          console.log('RESULT event:', JSON.stringify({
            subtype: parsed.subtype,
            stop_reason: parsed.stop_reason,
            duration_ms: parsed.duration_ms,
            duration_api_ms: parsed.duration_api_ms,
            num_turns: parsed.num_turns,
            is_error: parsed.is_error,
            total_cost_usd: parsed.total_cost_usd,
            result_preview: typeof parsed.result === 'string' ? parsed.result.substring(0, 200) : undefined,
          }, null, 2))
        }
      } catch {}
    }
    // Show last 500 chars of stdout to see how it ended
    console.log('Stdout tail:', t.stdoutRaw.substring(t.stdoutRaw.length - 500))
  }

  if (t.stderrRaw) {
    const lines = t.stderrRaw.split('\n').filter(l => l.trim())
    if (lines.length > 0) {
      console.log('Stderr lines:', lines.length)
      lines.slice(-5).forEach(l => console.log('  STDERR:', l.substring(0, 300)))
    }
  }

  console.log('')
}

// Also check the conversation details
const conv = await p.conversation.findUnique({
  where: { id: convId },
  include: {
    workflow: { select: { name: true, type: true } },
    messages: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, role: true, content: true, stepId: true, createdAt: true } }
  }
})
console.log('=== CONVERSATION ===')
console.log('Title:', conv.title)
console.log('Workflow:', conv.workflow.name, '(', conv.workflow.type, ')')
console.log('ProjectPath:', conv.projectPath)
console.log('')
console.log('=== LAST MESSAGES ===')
for (const m of conv.messages) {
  console.log(`[${m.role}] ${m.createdAt} (step: ${m.stepId})`)
  console.log('  ', m.content?.substring(0, 200))
  console.log('')
}

await p.$disconnect()
