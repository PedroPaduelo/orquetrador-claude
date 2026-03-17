import { prisma } from '../../../lib/prisma.js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  apiKey: process.env.ANTHROPIC_API_KEY || 'sk-placeholder',
})

export class MemoryManager {
  /**
   * Busca a memória salva para uma conversa+step
   */
  async getMemory(conversationId: string, stepId: string): Promise<string | null> {
    const memory = await prisma.stepMemory.findUnique({
      where: {
        conversationId_stepId: {
          conversationId,
          stepId,
        },
      },
    })
    return memory?.content || null
  }

  /**
   * Salva ou atualiza a memória de um step
   */
  async saveMemory(conversationId: string, stepId: string, content: string): Promise<void> {
    await prisma.stepMemory.upsert({
      where: {
        conversationId_stepId: {
          conversationId,
          stepId,
        },
      },
      create: {
        conversationId,
        stepId,
        content,
      },
      update: {
        content,
      },
    })
  }

  /**
   * Deleta a memória de um step
   */
  async deleteMemory(conversationId: string, stepId: string): Promise<void> {
    await prisma.stepMemory.deleteMany({
      where: {
        conversationId,
        stepId,
      },
    })
  }

  /**
   * Resumir o contexto da conversa antes de compactar.
   * Pega as mensagens do DB + memória anterior e gera um resumo acumulativo.
   */
  async summarizeAndSave(conversationId: string, stepId: string): Promise<string> {
    // Buscar memória anterior (se existir)
    const previousMemory = await this.getMemory(conversationId, stepId)

    // Buscar todas as mensagens desse step nessa conversa
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        stepId,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        content: true,
        createdAt: true,
      },
    })

    if (messages.length === 0 && !previousMemory) {
      return ''
    }

    // Montar o conteúdo para resumir
    const conversationText = messages
      .map(m => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 3000)}`)
      .join('\n\n')

    const promptParts: string[] = []

    if (previousMemory) {
      promptParts.push(`## Memória anterior acumulada:\n${previousMemory}`)
    }

    if (conversationText) {
      promptParts.push(`## Conversa recente:\n${conversationText}`)
    }

    const summaryPrompt = `Você é um assistente que cria resumos de contexto para manter continuidade em conversas longas.

Analise o conteúdo abaixo e crie um resumo COMPLETO e ESTRUTURADO que capture:

1. **O que foi solicitado** — pedidos do usuário
2. **O que foi feito** — implementações, alterações, decisões tomadas
3. **Estado atual** — onde parou, o que está funcionando, o que falta
4. **Arquivos alterados** — lista de arquivos criados/modificados
5. **Decisões técnicas** — tecnologias escolhidas, padrões adotados
6. **Problemas encontrados** — erros, bugs, soluções aplicadas
7. **Contexto importante** — qualquer informação que seria necessária para continuar o trabalho

O resumo deve ser denso mas legível. Use bullet points. Não perca informações críticas.
Responda APENAS com o resumo, sem introdução ou conclusão.

${promptParts.join('\n\n---\n\n')}`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: summaryPrompt,
        }],
      })

      const summary = response.content[0].type === 'text' ? response.content[0].text : ''

      if (summary) {
        await this.saveMemory(conversationId, stepId, summary)
      }

      return summary
    } catch (err) {
      console.error(`[MemoryManager] Erro ao resumir conversa para step ${stepId}:`, err)
      // Se falhar, salvar um resumo simples baseado nas últimas mensagens
      const fallback = previousMemory
        ? `${previousMemory}\n\n---\n\n[Resumo automático falhou. Últimas ${messages.length} mensagens não resumidas.]`
        : `[Resumo automático falhou. ${messages.length} mensagens no histórico.]`
      await this.saveMemory(conversationId, stepId, fallback)
      return fallback
    }
  }
}

export const memoryManager = new MemoryManager()
