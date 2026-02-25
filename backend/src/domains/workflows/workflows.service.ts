import { workflowsRepository } from './workflows.repository.js'

export const workflowsService = {
  async duplicate(id: string, userId: string) {
    const original = await workflowsRepository.findByIdRaw(id)
    if (!original) return null

    return workflowsRepository.create({
      name: `${original.name} (Cópia)`,
      description: original.description,
      type: original.type,
      steps: original.steps.map((step) => ({
        name: step.name,
        baseUrl: step.baseUrl,
        systemPrompt: step.systemPrompt,
        conditions: JSON.parse(step.conditions),
        maxRetries: step.maxRetries,
        backend: step.backend,
        model: step.model,
        mcpServerIds: step.mcpServers.map((s) => s.serverId),
        skillIds: step.skills.map((s) => s.skillId),
        agentIds: step.agents.map((s) => s.agentId),
        ruleIds: step.rules.map((s) => s.ruleId),
        hookIds: step.hooks.map((s) => s.hookId),
      })),
    }, userId)
  },
}
