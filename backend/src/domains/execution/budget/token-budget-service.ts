import { prisma } from '../../../lib/prisma.js'

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

export class TokenBudgetService {
  async getOrCreate(userId: string) {
    let budget = await prisma.userTokenBudget.findUnique({ where: { userId } })
    if (!budget) {
      budget = await prisma.userTokenBudget.create({
        data: { userId },
      })
    }

    // Reset daily if needed
    const now = new Date()
    const lastDaily = new Date(budget.lastDailyResetAt)
    if (now.getDate() !== lastDaily.getDate() || now.getMonth() !== lastDaily.getMonth() || now.getFullYear() !== lastDaily.getFullYear()) {
      budget = await prisma.userTokenBudget.update({
        where: { userId },
        data: { currentDailyUsage: 0, lastDailyResetAt: now },
      })
    }

    // Reset monthly if needed
    const lastMonthly = new Date(budget.lastMonthlyResetAt)
    if (now.getMonth() !== lastMonthly.getMonth() || now.getFullYear() !== lastMonthly.getFullYear()) {
      budget = await prisma.userTokenBudget.update({
        where: { userId },
        data: { currentMonthlyUsage: 0, lastMonthlyResetAt: now },
      })
    }

    return budget
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

    await this.getOrCreate(userId) // ensure resets happen
    await prisma.userTokenBudget.update({
      where: { userId },
      data: {
        currentDailyUsage: { increment: total },
        currentMonthlyUsage: { increment: total },
      },
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
