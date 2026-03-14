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
  useGitClone,
  useGitAccounts,
  useCreateGitAccount,
  useDeleteGitAccount,
} from './hooks/use-git'
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from './hooks/use-api-keys'
import { useBudget } from './hooks/use-budget'
import { gitApi } from './api'
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
  // Legacy token (backward compat)
  const { data: tokenStatus } = useGitTokenStatus()
  const saveLegacyMutation = useSaveGitToken()
  const removeLegacyMutation = useRemoveGitToken()

  // Multi-account
  const { data: accounts, isLoading } = useGitAccounts()
  const createAccountMutation = useCreateGitAccount()
  const deleteAccountMutation = useDeleteGitAccount()
  const cloneMutation = useGitClone()

  // State
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [accountLabel, setAccountLabel] = useState('')
  const [accountToken, setAccountToken] = useState('')
  const [showAccountToken, setShowAccountToken] = useState(false)

  // Browse repos per account
  const [browsingAccountId, setBrowsingAccountId] = useState<string | null>(null)
  const [accountRepos, setAccountRepos] = useState<GitRepo[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')

  // Clone dialog
  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<GitRepo | null>(null)
  const [cloneAccountId, setCloneAccountId] = useState<string | null>(null)
  const [cloneFolderName, setCloneFolderName] = useState('')

  // Legacy token input (for users who want to keep using the old way)
  const [showLegacyToken, setShowLegacyToken] = useState(false)
  const [legacyTokenInput, setLegacyTokenInput] = useState('')
  const [showLegacyTokenValue, setShowLegacyTokenValue] = useState(false)

  // Delete confirm
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null)
  const [showRemoveLegacy, setShowRemoveLegacy] = useState(false)

  const handleAddAccount = async () => {
    if (!accountLabel.trim() || !accountToken.trim()) return
    await createAccountMutation.mutateAsync({
      label: accountLabel.trim(),
      token: accountToken.trim(),
    })
    setAccountLabel('')
    setAccountToken('')
    setShowAddAccount(false)
    setShowAccountToken(false)
  }

  const handleBrowseRepos = async (accountId: string) => {
    if (browsingAccountId === accountId) {
      setBrowsingAccountId(null)
      setAccountRepos([])
      setRepoSearch('')
      return
    }
    setBrowsingAccountId(accountId)
    setIsLoadingRepos(true)
    setRepoSearch('')
    try {
      const repos = await gitApi.listAccountRepos(accountId, 1, 50)
      setAccountRepos(repos)
    } catch {
      toast.error('Erro ao carregar repositorios')
      setAccountRepos([])
    } finally {
      setIsLoadingRepos(false)
    }
  }

  const handleClone = async () => {
    if (!selectedRepo) return
    await cloneMutation.mutateAsync({
      repoUrl: selectedRepo.cloneUrl,
      folderName: cloneFolderName || undefined,
      branch: selectedRepo.defaultBranch,
      gitAccountId: cloneAccountId || undefined,
    })
    setShowCloneDialog(false)
    setSelectedRepo(null)
    setCloneFolderName('')
    setCloneAccountId(null)
  }

  const handleSaveLegacyToken = async () => {
    if (!legacyTokenInput.trim()) return
    await saveLegacyMutation.mutateAsync(legacyTokenInput.trim())
    setLegacyTokenInput('')
    setShowLegacyToken(false)
    setShowLegacyTokenValue(false)
  }

  const filteredRepos = accountRepos.filter((r) =>
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

  const hasAccounts = accounts && accounts.length > 0

  return (
    <>
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-zinc-900 flex items-center justify-center">
                <Github className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Contas GitHub</h2>
                <p className="text-xs text-muted-foreground">
                  Conecte multiplas contas para clonar, push e pull com credenciais separadas
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowAddAccount(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Nova Conta
            </Button>
          </div>

          {/* Accounts List */}
          {hasAccounts ? (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div key={account.id} className="rounded-lg border">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                        <Github className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{account.label}</p>
                          {account.username && (
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/5 text-[10px] px-1.5 py-0 gap-1">
                              <Check className="h-2.5 w-2.5" />
                              @{account.username}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Adicionada em {new Date(account.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBrowseRepos(account.id)}
                        disabled={isLoadingRepos && browsingAccountId === account.id}
                      >
                        {isLoadingRepos && browsingAccountId === account.id ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <GitBranch className="h-3.5 w-3.5 mr-1" />
                        )}
                        Repos
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteAccountId(account.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Repos for this account */}
                  {browsingAccountId === account.id && (
                    <div className="border-t px-4 py-3 space-y-3">
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
                        <Button variant="ghost" size="sm" onClick={() => { setBrowsingAccountId(null); setAccountRepos([]); setRepoSearch('') }}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="max-h-[300px] overflow-y-auto divide-y rounded-lg border">
                        {isLoadingRepos ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : filteredRepos.length > 0 ? (
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
                                  setCloneAccountId(account.id)
                                  setCloneFolderName(repo.name)
                                  setShowCloneDialog(true)
                                }}
                              >
                                <Download className="h-3.5 w-3.5 mr-1" />
                                Clonar
                              </Button>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Nenhum repositorio encontrado
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Github className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma conta GitHub conectada
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Adicione contas para clonar repos e fazer push/pull
              </p>
            </div>
          )}

          {/* Legacy token section (collapsible) */}
          {tokenStatus?.hasToken && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Legado</Badge>
                  <p className="text-xs text-muted-foreground">
                    Token padrao {tokenStatus.username ? `(@${tokenStatus.username})` : ''} — usado como fallback
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
                  onClick={() => setShowRemoveLegacy(true)}
                >
                  Remover
                </Button>
              </div>
            </div>
          )}

          {/* Add legacy token if no accounts and no legacy */}
          {!tokenStatus?.hasToken && !hasAccounts && (
            <div className="space-y-2">
              <button
                type="button"
                className="text-[11px] text-muted-foreground hover:text-foreground underline"
                onClick={() => setShowLegacyToken(!showLegacyToken)}
              >
                Ou use um token padrao (legado)
              </button>
              {showLegacyToken && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showLegacyTokenValue ? 'text' : 'password'}
                      value={legacyTokenInput}
                      onChange={(e) => setLegacyTokenInput(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="pr-10 h-8 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveLegacyToken()}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowLegacyTokenValue(!showLegacyTokenValue)}
                    >
                      {showLegacyTokenValue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <Button size="sm" onClick={handleSaveLegacyToken} disabled={!legacyTokenInput.trim() || saveLegacyMutation.isPending}>
                    {saveLegacyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              Cada projeto clonado fica vinculado a conta usada no clone. Push e pull usam automaticamente as credenciais corretas.{' '}
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
        </CardContent>
      </Card>

      {/* Add Account Dialog */}
      <Dialog open={showAddAccount} onOpenChange={(open) => { if (!open) { setShowAddAccount(false); setAccountLabel(''); setAccountToken(''); setShowAccountToken(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Conta GitHub</DialogTitle>
            <DialogDescription>
              Conecte uma conta GitHub com um Personal Access Token (classic) com permissao <code className="bg-muted px-1 py-0.5 rounded text-[11px]">repo</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da conta</Label>
              <Input
                value={accountLabel}
                onChange={(e) => setAccountLabel(e.target.value)}
                placeholder="Ex: Pessoal, Trabalho, Cliente X"
              />
            </div>
            <div className="space-y-2">
              <Label>Token</Label>
              <div className="relative">
                <Input
                  type={showAccountToken ? 'text' : 'password'}
                  value={accountToken}
                  onChange={(e) => setAccountToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="pr-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAccountToken(!showAccountToken)}
                >
                  {showAccountToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
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
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowAddAccount(false); setAccountLabel(''); setAccountToken(''); setShowAccountToken(false) }}>
                Cancelar
              </Button>
              <Button
                onClick={handleAddAccount}
                disabled={!accountLabel.trim() || !accountToken.trim() || createAccountMutation.isPending}
              >
                {createAccountMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Conectar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
            {cloneAccountId && accounts && (
              <p className="text-xs text-muted-foreground">
                Conta: <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{accounts.find(a => a.id === cloneAccountId)?.label}</Badge>
              </p>
            )}
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

      {/* Delete Account Confirm */}
      <ConfirmDialog
        open={!!deleteAccountId}
        onOpenChange={(open) => { if (!open) setDeleteAccountId(null) }}
        title="Remover conta GitHub?"
        description="Os projetos clonados com esta conta perderao o vinculo. Voce podera reconectar depois."
        confirmLabel="Remover"
        onConfirm={() => {
          if (deleteAccountId) deleteAccountMutation.mutate(deleteAccountId)
          setDeleteAccountId(null)
        }}
        variant="destructive"
      />

      {/* Remove Legacy Confirm */}
      <ConfirmDialog
        open={showRemoveLegacy}
        onOpenChange={setShowRemoveLegacy}
        title="Remover token legado?"
        description="Projetos sem conta vinculada nao poderao mais fazer push/pull."
        confirmLabel="Remover"
        onConfirm={() => removeLegacyMutation.mutate()}
        variant="destructive"
      />
    </>
  )
}
