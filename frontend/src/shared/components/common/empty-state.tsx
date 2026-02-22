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
    <div className={cn('flex flex-col items-center justify-center py-16 text-center animate-fade-in-up', className)}>
      <div className="relative mb-6">
        <div className="rounded-2xl bg-primary/8 p-6">
          <Icon className="h-10 w-10 text-primary/70" />
        </div>
        <div className="absolute -inset-2 rounded-3xl bg-primary/5 blur-2xl -z-10" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-6 max-w-md leading-relaxed">{description}</p>
      )}
      {action}
    </div>
  )
}
