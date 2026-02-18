import { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="relative mb-5">
        <div className="rounded-2xl bg-primary/5 p-5">
          <Icon className="h-8 w-8 text-primary/60" />
        </div>
        <div className="absolute -inset-1 rounded-2xl bg-primary/5 blur-xl -z-10" />
      </div>
      <h3 className="text-lg font-semibold mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-5 max-w-sm leading-relaxed">{description}</p>
      )}
      {action}
    </div>
  )
}
