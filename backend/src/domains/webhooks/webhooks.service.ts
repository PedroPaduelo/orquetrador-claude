import { createHmac, randomBytes } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import { webhooksRepository } from './webhooks.repository.js'

export const webhooksService = {
  generateSecret(): string {
    return randomBytes(32).toString('hex')
  },

  signPayload(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex')
  },

  async dispatch(event: string, data: Record<string, unknown>, userId: string): Promise<void> {
    const webhooks = await webhooksRepository.findByEvent(event, userId)

    for (const webhook of webhooks) {
      const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() })
      const signature = this.signPayload(payload, webhook.secret)

      const delivery = await prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          payload,
          status: 'pending',
        },
      })

      // Fire-and-forget with retry
      this.deliverWithRetry(delivery.id, webhook.url, payload, signature, 3).catch(err => {
        console.error('[Webhook] Delivery error:', err.message)
      })
    }
  },

  async deliverWithRetry(deliveryId: string, url: string, payload: string, signature: string, maxAttempts: number): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${signature}`,
            'X-Webhook-Event': 'execut',
          },
          body: payload,
          signal: AbortSignal.timeout(10_000),
        })

        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            responseCode: response.status,
            responseBody: (await response.text()).slice(0, 1000),
            attempts: attempt,
            status: response.ok ? 'success' : 'failed',
            completedAt: new Date(),
          },
        })

        if (response.ok) return
      } catch (err) {
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            attempts: attempt,
            status: attempt >= maxAttempts ? 'failed' : 'pending',
            responseBody: (err as Error).message.slice(0, 500),
            ...(attempt >= maxAttempts ? { completedAt: new Date() } : {}),
          },
        })
      }

      if (attempt < maxAttempts) {
        // Exponential backoff: 1s, 4s, 9s
        await new Promise(resolve => setTimeout(resolve, attempt * attempt * 1000))
      }
    }
  },
}
