/**
 * Distributed Event Bus — wires OrchestratorEvents to Redis PubSub.
 *
 * Activation is controlled by the DISTRIBUTED_EVENTS env var:
 *   - DISTRIBUTED_EVENTS=true  -> enable Redis PubSub propagation
 *   - (absent or any other)    -> keep default local-only EventEmitter
 *
 * This module creates dedicated Redis publisher/subscriber connections so it
 * does not interfere with the general-purpose Redis connection used by BullMQ
 * or caching.
 *
 * Usage (called once at server startup):
 *   import { initDistributedEvents, shutdownDistributedEvents } from './distributed-events.js'
 *   await initDistributedEvents()
 *
 *   // At shutdown:
 *   await shutdownDistributedEvents()
 */

import { Redis } from 'ioredis'
import { orchestratorEvents } from './events.js'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

let _publisher: Redis | null = null
let _subscriber: Redis | null = null

function createConnection(name: string): Redis {
  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectionName: `distributed-events:${name}`,
    retryStrategy(times: number) {
      // Exponential backoff capped at 5 seconds
      return Math.min(times * 200, 5000)
    },
  })

  redis.on('error', (err: Error) => {
    console.error(`[DistributedEvents:${name}] Redis error:`, err.message)
  })

  redis.on('connect', () => {
    console.log(`[DistributedEvents:${name}] Redis connected`)
  })

  redis.on('close', () => {
    console.log(`[DistributedEvents:${name}] Redis connection closed`)
  })

  return redis
}

/**
 * Initialise distributed event propagation if DISTRIBUTED_EVENTS=true.
 *
 * Safe to call multiple times — subsequent calls are no-ops.
 * If Redis is unreachable the function logs a warning and returns without
 * enabling distributed mode (local EventEmitter continues to work).
 */
export async function initDistributedEvents(): Promise<void> {
  const enabled = process.env.DISTRIBUTED_EVENTS === 'true'
  if (!enabled) {
    console.log('[DistributedEvents] Disabled (set DISTRIBUTED_EVENTS=true to enable)')
    return
  }

  if (orchestratorEvents.isDistributed) {
    console.log('[DistributedEvents] Already initialised, skipping')
    return
  }

  try {
    _publisher = createConnection('pub')
    _subscriber = createConnection('sub')

    // Connect both — wait up to 5 seconds
    await Promise.all([
      _publisher.connect(),
      _subscriber.connect(),
    ])

    // Verify connectivity with a PING
    await Promise.all([
      _publisher.ping(),
      _subscriber.ping(),
    ])

    orchestratorEvents.enableDistributed(_publisher, _subscriber)
    console.log('[DistributedEvents] Initialised successfully')
  } catch (err) {
    console.warn(
      '[DistributedEvents] Failed to initialise — falling back to local EventEmitter:',
      (err as Error).message,
    )

    // Clean up partial connections
    try { _publisher?.disconnect() } catch { /* ignore */ }
    try { _subscriber?.disconnect() } catch { /* ignore */ }
    _publisher = null
    _subscriber = null
  }
}

/**
 * Gracefully shut down distributed events (unsubscribe + disconnect Redis).
 */
export async function shutdownDistributedEvents(): Promise<void> {
  if (!orchestratorEvents.isDistributed) return

  await orchestratorEvents.disableDistributed()

  const tasks: Promise<void>[] = []
  if (_publisher) {
    tasks.push(_publisher.quit().then(() => {}))
    _publisher = null
  }
  if (_subscriber) {
    tasks.push(_subscriber.quit().then(() => {}))
    _subscriber = null
  }

  await Promise.allSettled(tasks)
  console.log('[DistributedEvents] Shut down')
}
