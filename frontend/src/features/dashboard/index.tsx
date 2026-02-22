import { useNavigate } from 'react-router-dom'
import {
  Plus,
  MessageSquare,
  Workflow,
  ArrowRight,
  Zap,
  Clock,
  GitBranch,
} from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useConversations } from '@/features/conversations/hooks/use-conversations'
import { useWorkflows } from '@/features/workflows/hooks/use-workflows'
import { formatDate } from '@/shared/lib/utils'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: conversations, isLoading: loadingConvs } = useConversations()
  const { data: workflows, isLoading: loadingWFs } = useWorkflows()

  const isLoading = loadingConvs || loadingWFs

  const recentConversations = conversations?.slice(0, 5) || []
  const totalMessages = conversations?.reduce((sum, c) => sum + (c.messagesCount || 0), 0) || 0
  const totalSteps = workflows?.reduce((sum, w) => sum + (w.stepsCount || 0), 0) || 0

  return (
    <div className="container py-8 space-y-8 page-enter">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-gradient">Execut</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          Orquestre workflows inteligentes com Claude
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Workflows"
          value={isLoading ? '-' : String(workflows?.length || 0)}
          subtitle="configurados"
          icon={Workflow}
          loading={isLoading}
        />
        <StatsCard
          title="Conversas"
          value={isLoading ? '-' : String(conversations?.length || 0)}
          subtitle="criadas"
          icon={MessageSquare}
          loading={isLoading}
        />
        <StatsCard
          title="Steps"
          value={isLoading ? '-' : String(totalSteps)}
          subtitle="total definidos"
          icon={GitBranch}
          loading={isLoading}
        />
        <StatsCard
          title="Mensagens"
          value={isLoading ? '-' : String(totalMessages)}
          subtitle="trocadas"
          icon={Zap}
          loading={isLoading}
        />
      </div>

      {/* Quick Actions + Recent */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick actions */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Ações rápidas</h2>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/conversations')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent transition-colors group text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                <Plus className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Nova Conversa</p>
                <p className="text-xs text-muted-foreground">Iniciar execução de um workflow</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>

            <button
              onClick={() => navigate('/workflows')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent transition-colors group text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20 transition-colors">
                <Workflow className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Novo Workflow</p>
                <p className="text-xs text-muted-foreground">Criar fluxo multi-step</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </div>
        </div>

        {/* Recent conversations */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Conversas recentes</h2>
            {recentConversations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/conversations')}
                className="text-muted-foreground"
              >
                Ver todas
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : recentConversations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <div className="relative mb-4">
                  <div className="rounded-2xl bg-primary/5 p-5">
                    <MessageSquare className="h-8 w-8 text-primary/60" />
                  </div>
                  <div className="absolute -inset-1 rounded-2xl bg-primary/5 blur-xl -z-10" />
                </div>
                <p className="text-base font-semibold">Bem-vindo ao Execut!</p>
                <p className="text-sm text-muted-foreground mt-1.5 mb-4 max-w-xs leading-relaxed">
                  Comece criando um workflow com steps e depois inicie uma conversa para executar.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => navigate('/workflows')}>
                    <Workflow className="h-3.5 w-3.5 mr-1.5" />
                    Criar Workflow
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate('/conversations')}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Nova Conversa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentConversations.map((conv, index) => (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/conversations/${conv.id}`)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent transition-all group text-left animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {conv.title || 'Sem título'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">
                        {conv.workflowName}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                        {conv.messagesCount || 0} msgs
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(conv.updatedAt)}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ElementType
  loading: boolean
}) {
  return (
    <Card className="overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
