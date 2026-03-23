import { prisma } from '../../../lib/prisma.js'
import type { Prisma } from '@prisma/client'

export interface BudgetCheck {
  allowed: boolean
  reason?: string
}

export interface UsageSummary {
  dailyUsage: number
  dailyLimit: number
  monthlyUsage: number
  monthlyLimit: number
  dailyPercent: number
  monthlyPercent: number
}

type TxClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export class TokenBudgetService {
  private async getOrCreateInTx(tx: TxClient, userId: string) {
    let budget = await tx.userTokenBudget.findUnique({ where: { userId } })
    if (!budget) {
      budget = await tx.userTokenBudget.create({
        data: { userId },
      })
    }

    const now = new Date()
    let needsUpdate = false
    const updateData: Record<string, unknown> = {}

    // Reset daily if needed
    const lastDaily = new Date(budget.lastDailyResetAt)
    if (now.getDate() !== lastDaily.getDate() || now.getMonth() !== lastDaily.getMonth() || now.getFullYear() !== lastDaily.getFullYear()) {
      updateData.currentDailyUsage = 0
      updateData.lastDailyResetAt = now
      needsUpdate = true
    }

    // Reset monthly if needed
    const lastMonthly = new Date(budget.lastMonthlyResetAt)
    if (now.getMonth() !== lastMonthly.getMonth() || now.getFullYear() !== lastMonthly.getFullYear()) {
      updateData.currentMonthlyUsage = 0
      updateData.lastMonthlyResetAt = now
      needsUpdate = true
    }

    if (needsUpdate) {
      budget = await tx.userTokenBudget.update({
        where: { userId },
        data: updateData as Prisma.UserTokenBudgetUpdateInput,
      })
    }

    return budget
  }

  async getOrCreate(userId: string) {
    return prisma.$transaction(async (tx) => {
      return this.getOrCreateInTx(tx, userId)
    })
  }

  async checkBudget(userId: string): Promise<BudgetCheck> {
    const budget = await this.getOrCreate(userId)

    if (budget.currentDailyUsage >= budget.dailyLimit) {
      return { allowed: false, reason: 'Daily token limit exceeded' }
    }
    if (budget.currentMonthlyUsage >= budget.monthlyLimit) {
      return { allowed: false, reason: 'Monthly token limit exceeded' }
    }
    return { allowed: true }
  }

  async recordUsage(userId: string, inputTokens: number, outputTokens: number): Promise<void> {
    const total = inputTokens + outputTokens
    if (total <= 0) return

    await prisma.$transaction(async (tx) => {
      await this.getOrCreateInTx(tx, userId) // ensure resets happen
      await tx.userTokenBudget.update({
        where: { userId },
        data: {
          currentDailyUsage: { increment: total },
          currentMonthlyUsage: { increment: total },
        },
      })
    })
  }

  async getUsageSummary(userId: string): Promise<UsageSummary> {
    const budget = await this.getOrCreate(userId)
    return {
      dailyUsage: budget.currentDailyUsage,
      dailyLimit: budget.dailyLimit,
      monthlyUsage: budget.currentMonthlyUsage,
      monthlyLimit: budget.monthlyLimit,
      dailyPercent: budget.dailyLimit > 0 ? Math.round((budget.currentDailyUsage / budget.dailyLimit) * 100) : 0,
      monthlyPercent: budget.monthlyLimit > 0 ? Math.round((budget.currentMonthlyUsage / budget.monthlyLimit) * 100) : 0,
    }
  }
}

export const tokenBudgetService = new TokenBudgetService()
