import type { WorkflowStep } from '@prisma/client'

interface DagStep {
  step: WorkflowStep
  index: number
  dependsOn: string[] // step IDs
}

export class DAGExecutor {
  private graph: Map<string, DagStep> = new Map()
  private completed = new Set<string>()
  private outputs = new Map<string, string>()

  constructor(steps: WorkflowStep[]) {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const deps: string[] = (step.dependsOn as string[] || [])
      this.graph.set(step.id, { step, index: i, dependsOn: deps })
    }
  }

  validate(): { valid: boolean; error?: string } {
    // Check all dependency refs exist
    for (const [_id, node] of this.graph) {
      for (const dep of node.dependsOn) {
        if (!this.graph.has(dep)) {
          return { valid: false, error: `Step "${node.step.name}" depends on unknown step ID "${dep}"` }
        }
      }
    }
    // Check for cycles using DFS
    const visited = new Set<string>()
    const inStack = new Set<string>()

    const hasCycle = (id: string): boolean => {
      if (inStack.has(id)) return true
      if (visited.has(id)) return false
      visited.add(id)
      inStack.add(id)
      const node = this.graph.get(id)!
      for (const dep of node.dependsOn) {
        if (hasCycle(dep)) return true
      }
      inStack.delete(id)
      return false
    }

    for (const id of this.graph.keys()) {
      if (hasCycle(id)) {
        return { valid: false, error: 'Cycle detected in step dependencies' }
      }
    }
    return { valid: true }
  }

  getReadySteps(): DagStep[] {
    const ready: DagStep[] = []
    for (const [id, node] of this.graph) {
      if (this.completed.has(id)) continue
      const allDepsCompleted = node.dependsOn.every(dep => this.completed.has(dep))
      if (allDepsCompleted) ready.push(node)
    }
    return ready
  }

  markCompleted(stepId: string, output: string): void {
    this.completed.add(stepId)
    this.outputs.set(stepId, output)
  }

  getDependencyContext(stepId: string): string {
    const node = this.graph.get(stepId)
    if (!node || node.dependsOn.length === 0) return ''

    const parts: string[] = []
    for (const depId of node.dependsOn) {
      const depNode = this.graph.get(depId)
      const output = this.outputs.get(depId)
      if (depNode && output) {
        parts.push(`[Output from "${depNode.step.name}"]:\n${output}`)
      }
    }
    return parts.join('\n\n')
  }

  isComplete(): boolean {
    return this.completed.size === this.graph.size
  }

  get totalSteps(): number {
    return this.graph.size
  }

  get completedCount(): number {
    return this.completed.size
  }
}

export function isDAGWorkflow(steps: WorkflowStep[]): boolean {
  return steps.some(step => {
    const deps = step.dependsOn as string[] || []
    return Array.isArray(deps) && deps.length > 0
  })
}
