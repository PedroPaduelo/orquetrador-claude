import {
  Shield,
  Sparkles,
  Paintbrush,
  FileText,
  Lock,
  TestTube,
  GitBranch,
  Eye,
  Terminal,
  MessageSquare,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { useHooksStore } from '../store'
import { useHookTemplates, useCreateFromTemplate } from '../hooks/use-hooks'
import type { HookTemplate } from '../types'

const templateIcons: Record<string, React.ElementType> = {
  'block-rm-rf': Shield,
  'auto-lint': Sparkles,
  'auto-format': Paintbrush,
  'log-operations': FileText,
  'block-secrets': Lock,
  'auto-test': TestTube,
  'git-auto-stage': GitBranch,
  'review-prompt': Eye,
}

const templateColors: Record<string, string> = {
  'block-rm-rf': 'from-red-500 to-red-600',
  'auto-lint': 'from-blue-500 to-blue-600',
  'auto-format': 'from-violet-500 to-violet-600',
  'log-operations': 'from-slate-500 to-slate-600',
  'block-secrets': 'from-amber-500 to-amber-600',
  'auto-test': 'from-green-500 to-green-600',
  'git-auto-stage': 'from-orange-500 to-orange-600',
  'review-prompt': 'from-cyan-500 to-cyan-600',
}

function TemplateCard({ template, onUse, isPending }: { template: HookTemplate; onUse: () => void; isPending: boolean }) {
  const Icon = templateIcons[template.id] || Terminal
  const gradient = templateColors[template.id] || 'from-gray-500 to-gray-600'

  return (
    <div className="group relative border rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all duration-200 bg-card">
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-sm`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{template.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <Badge variant="outline" className="text-[9px]">{template.eventType}</Badge>
            {template.matcher && (
              <Badge variant="secondary" className="text-[9px]">{template.matcher}</Badge>
            )}
            <Badge variant="secondary" className="text-[9px] gap-0.5">
              {template.handlerType === 'command' ? <Terminal className="h-2.5 w-2.5" /> : <MessageSquare className="h-2.5 w-2.5" />}
              {template.handlerType}
            </Badge>
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={onUse}
          disabled={isPending}
          className="h-7 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          {isPending ? 'Criando...' : 'Usar Template'}
        </Button>
      </div>
    </div>
  )
}

export function HookTemplatesDialog() {
  const { isTemplatesOpen, closeTemplates } = useHooksStore()
  const { data: templates, isLoading } = useHookTemplates()
  const createFromTemplate = useCreateFromTemplate()

  return (
    <Dialog open={isTemplatesOpen} onOpenChange={(open) => !open && closeTemplates()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Templates de Hooks
          </DialogTitle>
          <DialogDescription>
            Comece rapidamente com hooks pre-configurados. Voce pode personalizar apos criar.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {templates?.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onUse={() => createFromTemplate.mutate(template.id)}
                isPending={createFromTemplate.isPending}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
