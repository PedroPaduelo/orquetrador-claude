import { useState } from 'react'
import {
  Github,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  ExternalLink,
  Lock,
  GitBranch,
  Download,
  Search,
  Globe,
  Trash2,
  Key,
  Copy,
  Plus,
  Shield,
  Coins,
} from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Progress } from '@/shared/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { ConfirmDialog } from '@/shared/components/common/confirm-dialog'
import { useAuthStore } from '../auth/store'
import {
  useGitTokenStatus,
  useSaveGitToken,
  useRemoveGitToken,
  useGitRepos,
  useGitClone,
} from './hooks/use-git'
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from './hooks/use-api-keys'
import { useBudget } from './hooks/use-budget'
import type { GitRepo } from './api'
import { toast } from 'sonner'

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`
  }
  return String(value)
}

function getBudgetBadge(percent: number) {
  if (percent >= 100) {
    return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Limite atingido</Badge>
  }
  if (percent >= 80) {
    return (
      <Badge variant="outline" className="border-yellow-500/30 text-yellow-600 bg-yellow-500/10 text-[10px] px-1.5 py-0">
        Quase no limite
      </Badge>
    )
  }
  return null
}

function getProgressColor(percent: number): string {
  if (percent >= 100) return '[&>div]:bg-destructive'
  if (percent >= 80) return '[&>div]:bg-yellow-500'
  return ''
}

function TokenBudgetSection() {
  const { data: budget, isLoading } = useBudget()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Carregando...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!budget) return null

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Coins className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Token Budget</h2>
            <p className="text-xs text-muted-foreground">
              Consumo de tokens da API Claude
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Daily usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Diario</span>
                {getBudgetBadge(budget.dailyPercent)}
              </div>
              <span className="text-sm text-muted-foreground">
                {formatTokenCount(budget.dailyUsage)} / {formatTokenCount(budget.dailyLimit)}
              </span>
            </div>
            <Progress
              value={Math.min(budget.dailyPercent, 100)}
              className={getProgressColor(budget.dailyPercent)}
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {budget.dailyPercent.toFixed(1)}% utilizado
            </p>
          </div>

          {/* Monthly usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Mensal</span>
                {getBudgetBadge(budget.monthlyPercent)}
              </div>
              <span className="text-sm text-muted-foreground">
                {formatTokenCount(budget.monthlyUsage)} / {formatTokenCount(budget.monthlyLimit)}
              </span>
            </div>
            <Progress
              value={Math.min(budget.monthlyPercent, 100)}
              className={getProgressColor(budget.monthlyPercent)}
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {budget.monthlyPercent.toFixed(1)}% utilizado
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const { user } = useAuthStore()

  return (
    <div className="container py-8 space-y-8 page-enter">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuracoes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie sua conta e integracoes
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold mb-4">Perfil</h2>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {(user?.name || user?.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{user?.name || 'Sem nome'}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Pasta de projetos: <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">{user?.basePath}</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Token Budget */}
      <TokenBudgetSection />

      {/* API Keys */}
      <ApiKeysSection />

      {/* GitHub Integration */}
      <GitHubSection />
    </div>
  )
}

function ApiKeysSection() {
  const { data: keys, isLoading } = useApiKeys()
  const createMutation = useCreateApiKey()
  const revokeMutation = useRevokeApiKey()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [revokeId, setRevokeId] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!keyName.trim()) return
    const result = await createMutation.mutateAsync(keyName.trim())
    setCreatedKey(result.key)
    setKeyName('')
  }

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey)
      toast.success('API key copiada!')
    }
  }

  const handleCloseCreate = () => {
    setShowCreateDialog(false)
    setCreatedKey(null)
    setKeyName('')
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Carregando...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Key className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold">API Keys</h2>
                <p className="text-xs text-muted-foreground">
                  Chaves para autenticar o MCP Server e acessos externos
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Nova Key
            </Button>
          </div>

          {keys && keys.length > 0 ? (
            <div className="divide-y rounded-lg border">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{k.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {k.prefix}...
                        </code>
                        <span className="text-[11px] text-muted-foreground">
                          Criada em {new Date(k.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                        {k.lastUsedAt && (
                          <span className="text-[11px] text-muted-foreground">
                            · Usada em {new Date(k.lastUsedAt).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => setRevokeId(k.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Key className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma API key criada ainda
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Crie uma key para autenticar o MCP Server
              </p>
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Como usar:</strong> Apos gerar a key, configure a variavel de ambiente{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px]">EXECUT_API_KEY</code>{' '}
              no MCP Server com o valor da key gerada.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) handleCloseCreate() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdKey ? 'API Key Criada' : 'Nova API Key'}</DialogTitle>
            <DialogDescription>
              {createdKey
                ? 'Copie a key agora. Ela nao sera exibida novamente.'
                : 'De um nome para identificar esta key.'}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4 py-2">
              <div className="flex gap-2">
                <Input
                  value={createdKey}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" onClick={handleCopyKey}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Guarde esta key em local seguro. Apos fechar, nao sera possivel ve-la novamente.
                </p>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCloseCreate}>Fechar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="Ex: MCP Server Local"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseCreate}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!keyName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Gerar Key'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Confirm */}
      <ConfirmDialog
        open={!!revokeId}
        onOpenChange={(open) => { if (!open) setRevokeId(null) }}
        title="Revogar API Key?"
        description="A key sera desativada imediatamente. Servicos que a utilizam perderao acesso."
        confirmLabel="Revogar"
        onConfirm={() => {
          if (revokeId) revokeMutation.mutate(revokeId)
          setRevokeId(null)
        }}
        variant="destructive"
      />
    </>
  )
}

function GitHubSection() {
  const { data: tokenStatus, isLoading } = useGitTokenStatus()
  const saveMutation = useSaveGitToken()
  const removeMutation = useRemoveGitToken()
  const { data: repos, refetch: fetchRepos, isFetching: isLoadingRepos } = useGitRepos()
  const cloneMutation = useGitClone()

  const [tokenInput, setTokenInput] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<GitRepo | null>(null)
  const [cloneFolderName, setCloneFolderName] = useState('')
  const [showRepos, setShowRepos] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return
    await saveMutation.mutateAsync(tokenInput.trim())
    setTokenInput('')
    setShowToken(false)
  }

  const handleShowRepos = () => {
    setShowRepos(true)
    fetchRepos()
  }

  const handleClone = async () => {
    if (!selectedRepo) return
    await cloneMutation.mutateAsync({
      repoUrl: selectedRepo.cloneUrl,
      folderName: cloneFolderName || undefined,
      branch: selectedRepo.defaultBranch,
    })
    setShowCloneDialog(false)
    setSelectedRepo(null)
    setCloneFolderName('')
  }

  const filteredRepos = repos?.filter((r) =>
    r.fullName.toLowerCase().includes(repoSearch.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(repoSearch.toLowerCase())
  )

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Carregando...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-zinc-900 flex items-center justify-center">
                <Github className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold">GitHub</h2>
                <p className="text-xs text-muted-foreground">
                  Vincule seu token para clonar repos, fazer push e pull
                </p>
              </div>
            </div>
            {tokenStatus?.hasToken && (
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/5 gap-1.5">
                <Check className="h-3 w-3" />
                Conectado
                {tokenStatus.username && ` (@${tokenStatus.username})`}
              </Badge>
            )}
          </div>

          {tokenStatus?.hasToken ? (
            // Connected state
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Check className="h-4 w-4 text-emerald-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Token configurado</p>
                  <p className="text-xs text-muted-foreground">
                    {tokenStatus.username
                      ? `Autenticado como @${tokenStatus.username}`
                      : 'Token valido'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowRemoveConfirm(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Remover
                </Button>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleShowRepos} disabled={isLoadingRepos}>
                  {isLoadingRepos ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5 mr-1.5" />}
                  Meus Repositorios
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Gerenciar Tokens
                  </a>
                </Button>
              </div>

              {/* Repos List */}
              {showRepos && (
                <div className="space-y-3 border rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={repoSearch}
                        onChange={(e) => setRepoSearch(e.target.value)}
                        placeholder="Buscar repositorios..."
                        className="pl-8 h-8 text-sm"
                      />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowRepos(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto divide-y rounded-lg border">
                    {filteredRepos && filteredRepos.length > 0 ? (
                      filteredRepos.map((repo) => (
                        <div
                          key={repo.id}
                          className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0 mr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{repo.fullName}</span>
                              {repo.private ? (
                                <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                              ) : (
                                <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                            </div>
                            {repo.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{repo.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {repo.language && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {repo.language}
                                </Badge>
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(repo.updatedAt).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRepo(repo)
                              setCloneFolderName(repo.name)
                              setShowCloneDialog(true)
                            }}
                          >
                            <Download className="h-3.5 w-3.5 mr-1" />
                            Clonar
                          </Button>
                        </div>
                      ))
                    ) : isLoadingRepos ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhum repositorio encontrado
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Not connected state
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Cole seu Personal Access Token (classic) do GitHub. Ele precisa de permissao <code className="bg-muted px-1 py-0.5 rounded text-[11px]">repo</code> para acessar repositorios privados.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="pr-10"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveToken()}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    onClick={handleSaveToken}
                    disabled={!tokenInput.trim() || saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Salvar'
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Execut+Orchestrator"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Criar token no GitHub
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clone Dialog */}
      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clonar Repositorio</DialogTitle>
            <DialogDescription>
              {selectedRepo?.fullName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da pasta</Label>
              <Input
                value={cloneFolderName}
                onChange={(e) => setCloneFolderName(e.target.value)}
                placeholder={selectedRepo?.name}
              />
              <p className="text-xs text-muted-foreground">
                Sera criada dentro da sua pasta de projetos
              </p>
            </div>
            {selectedRepo?.defaultBranch && (
              <p className="text-xs text-muted-foreground">
                Branch: <code className="bg-muted px-1 py-0.5 rounded">{selectedRepo.defaultBranch}</code>
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCloneDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleClone}
              disabled={cloneMutation.isPending}
            >
              {cloneMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Clonando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-1.5" />
                  Clonar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Confirm */}
      <ConfirmDialog
        open={showRemoveConfirm}
        onOpenChange={setShowRemoveConfirm}
        title="Remover token GitHub?"
        description="Voce nao podera mais clonar repos privados ou fazer push/pull ate configurar um novo token."
        confirmLabel="Remover"
        onConfirm={() => removeMutation.mutate()}
        variant="destructive"
      />
    </>
  )
}
