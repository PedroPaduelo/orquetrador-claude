import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

function createConnection(name: string): Redis {
  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectionName: name,
  })

  redis.on('error', (err) => {
    console.error(`[Redis:${name}] Connection error:`, err.message)
  })

  redis.on('connect', () => {
    console.log(`[Redis:${name}] Connected`)
  })

  return redis
}

// Lazy singletons — only connect when first accessed
let _general: Redis | null = null
let _subscriber: Redis | null = null
let _publisher: Redis | null = null

export function getRedis(): Redis {
  if (!_general) {
    _general = createConnection('general')
    _general.connect().catch(() => {})
  }
  return _general
}

export function getSubscriber(): Redis {
  if (!_subscriber) {
    _subscriber = createConnection('subscriber')
    _subscriber.connect().catch(() => {})
  }
  return _subscriber
}

export function getPublisher(): Redis {
  if (!_publisher) {
    _publisher = createConnection('publisher')
    _publisher.connect().catch(() => {})
  }
  return _publisher
}

export async function closeAllRedis(): Promise<void> {
  const closeTasks: Promise<void>[] = []
  if (_general) {
    closeTasks.push(_general.quit().then(() => {}))
    _general = null
  }
  if (_subscriber) {
    closeTasks.push(_subscriber.quit().then(() => {}))
    _subscriber = null
  }
  if (_publisher) {
    closeTasks.push(_publisher.quit().then(() => {}))
    _publisher = null
  }
  await Promise.allSettled(closeTasks)
}
