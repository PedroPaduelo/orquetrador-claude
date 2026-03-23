import { useQuery } from '@tanstack/react-query'
import { tracesApi } from '../api/traces.api'

export function useConversationTraces(conversationId: string) {
  return useQuery({
    queryKey: ['traces', conversationId],
    queryFn: () => tracesApi.listByConversation(conversationId),
    enabled: !!conversationId,
    staleTime: 30_000,
  })
}

export function useTraceDetail(traceId: string | null) {
  return useQuery({
    queryKey: ['trace', traceId],
    queryFn: () => tracesApi.getDetail(traceId!),
    enabled: !!traceId,
    staleTime: 60_000,
  })
}
