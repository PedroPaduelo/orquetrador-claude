import { apiClient } from '@/shared/lib/api-client'

export interface TraceSummary {
  id: string
  executionId: string
  stepId: string
  resultStatus: string
  durationMs: number | null
  contentLength: number
  actionsCount: number
  errorMessage: string | null
  createdAt: string
}

export interface ParsedEvent {
  t: number  // offset ms from start
  k: string  // event type: content, action, error, session, usage, metadata
  d?: {
    type?: string
    name?: string
    msg?: string
    sid?: string
    in?: number
    out?: number
    cacheIn?: number
    cacheRead?: number
    [key: string]: unknown
  }
}

export interface TraceDetail {
  id: string
  executionId: string
  conversationId: string
  stepId: string
  commandLine: string
  messageLength: number
  model: string | null
  projectPath: string
  parsedEvents: ParsedEvent[]
  startedAt: string
  firstByteAt: string | null
  firstContentAt: string | null
  completedAt: string | null
  durationMs: number | null
  exitCode: number | null
  resultStatus: string
  errorMessage: string | null
  errorCategory: string | null
  contentLength: number
  actionsCount: number
  inputTokens?: number
  outputTokens?: number
  totalCostUsd?: number | null
  createdAt: string
}

export const tracesApi = {
  listByConversation: async (conversationId: string): Promise<TraceSummary[]> => {
    const { data } = await apiClient.get(`/conversations/${conversationId}/traces`)
    return data
  },

  getDetail: async (traceId: string): Promise<TraceDetail> => {
    const { data } = await apiClient.get(`/traces/${traceId}`)
    return data
  },
}
