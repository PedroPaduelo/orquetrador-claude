import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useSettings, useUpdateSettings } from './hooks/use-settings'
import type { AppSettings } from './types'

interface FormData {
  defaultModel: string
  defaultProjectPath: string
  claudeBinPath: string
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const updateMutation = useUpdateSettings()

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<FormData>({
    defaultValues: {
      defaultModel: '',
      defaultProjectPath: '',
      claudeBinPath: '',
    },
  })

  useEffect(() => {
    if (settings) {
      reset({
        defaultModel: settings.defaultModel || '',
        defaultProjectPath: settings.defaultProjectPath || '',
        claudeBinPath: settings.claudeBinPath || '',
      })
    }
  }, [settings, reset])

  const onSubmit = (data: FormData) => {
    const input: Partial<AppSettings> = {
      defaultModel: data.defaultModel || null,
      defaultProjectPath: data.defaultProjectPath || null,
      claudeBinPath: data.claudeBinPath || null,
    }
    updateMutation.mutate(input)
  }

  return (
    <div className="container py-8 space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuracoes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure as opcoes gerais do sistema
        </p>
      </div>

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-xl mt-4">
              <div>
                <Label htmlFor="defaultModel">Modelo Padrao</Label>
                <Input
                  id="defaultModel"
                  {...register('defaultModel')}
                  placeholder="claude-sonnet-4-20250514"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Modelo usado por padrao nas sessoes do Claude
                </p>
              </div>

              <div>
                <Label htmlFor="defaultProjectPath">Caminho Padrao do Projeto</Label>
                <Input
                  id="defaultProjectPath"
                  {...register('defaultProjectPath')}
                  placeholder="/home/user/projects"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Diretorio padrao ao iniciar sessoes
                </p>
              </div>

              <div>
                <Label htmlFor="claudeBinPath">Caminho do Binario Claude</Label>
                <Input
                  id="claudeBinPath"
                  {...register('claudeBinPath')}
                  placeholder="/usr/local/bin/claude"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Caminho completo para o executavel do Claude CLI
                </p>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
