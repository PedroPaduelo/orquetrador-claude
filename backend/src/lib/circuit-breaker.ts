type CircuitState = 'closed' | 'open' | 'half-open'

interface CircuitInfo {
  failures: number
  state: CircuitState
  lastFailureAt: number | null
}

const MAX_FAILURES = 3
const COOLDOWN_MS = 60_000 // 60 seconds

export class CircuitBreakerManager {
  private circuits = new Map<string, CircuitInfo>()

  private getCircuit(serverId: string): CircuitInfo {
    let circuit = this.circuits.get(serverId)
    if (!circuit) {
      circuit = { failures: 0, state: 'closed', lastFailureAt: null }
      this.circuits.set(serverId, circuit)
    }
    return circuit
  }

  canCall(serverId: string): boolean {
    const circuit = this.getCircuit(serverId)

    if (circuit.state === 'closed') return true

    if (circuit.state === 'open') {
      // Check if cooldown has passed
      if (circuit.lastFailureAt && Date.now() - circuit.lastFailureAt >= COOLDOWN_MS) {
        circuit.state = 'half-open'
        return true
      }
      return false
    }

    // half-open: allow one request
    return true
  }

  recordSuccess(serverId: string): void {
    const circuit = this.getCircuit(serverId)
    circuit.failures = 0
    circuit.state = 'closed'
    circuit.lastFailureAt = null
  }

  recordFailure(serverId: string): void {
    const circuit = this.getCircuit(serverId)
    circuit.failures++
    circuit.lastFailureAt = Date.now()

    if (circuit.failures >= MAX_FAILURES) {
      circuit.state = 'open'
    }
  }

  reset(serverId: string): void {
    this.circuits.delete(serverId)
  }

  getStatus(serverId: string): { state: CircuitState; failures: number } {
    const circuit = this.getCircuit(serverId)
    // Auto-transition from open to half-open if cooldown passed
    if (circuit.state === 'open' && circuit.lastFailureAt && Date.now() - circuit.lastFailureAt >= COOLDOWN_MS) {
      circuit.state = 'half-open'
    }
    return { state: circuit.state, failures: circuit.failures }
  }

  getAllStatuses(): Record<string, { state: CircuitState; failures: number }> {
    const result: Record<string, { state: CircuitState; failures: number }> = {}
    for (const [id] of this.circuits) {
      result[id] = this.getStatus(id)
    }
    return result
  }
}

export const circuitBreaker = new CircuitBreakerManager()
