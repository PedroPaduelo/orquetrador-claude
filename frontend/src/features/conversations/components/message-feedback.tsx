import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/shared/lib/api-client'
import { cn } from '@/shared/lib/utils'

interface MessageFeedbackProps {
  messageId: string
}

export function MessageFeedback({ messageId }: MessageFeedbackProps) {
  const queryClient = useQueryClient()
  const [hovering, setHovering] = useState(false)

  const { data: feedback } = useQuery({
    queryKey: ['message-feedback', messageId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/messages/${messageId}/feedback`)
      return data as { rating: number } | null
    },
    staleTime: Infinity,
  })

  const mutation = useMutation({
    mutationFn: async (rating: number) => {
      await apiClient.post(`/messages/${messageId}/feedback`, { rating })
    },
    onSuccess: (_, rating) => {
      queryClient.setQueryData(['message-feedback', messageId], { rating })
    },
  })

  const currentRating = feedback?.rating ?? null

  const handleRate = useCallback((rating: number) => {
    // Toggle off if already selected
    if (currentRating === rating) return
    mutation.mutate(rating)
  }, [currentRating, mutation])

  return (
    <div
      className={cn(
        'flex items-center gap-1 transition-opacity',
        hovering || currentRating ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100',
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        onClick={() => handleRate(5)}
        className={cn(
          'p-1 rounded hover:bg-muted transition-colors',
          currentRating === 5 ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground',
        )}
        title="Boa resposta"
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        onClick={() => handleRate(1)}
        className={cn(
          'p-1 rounded hover:bg-muted transition-colors',
          currentRating === 1 ? 'text-red-500' : 'text-muted-foreground hover:text-foreground',
        )}
        title="Resposta ruim"
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  )
}
