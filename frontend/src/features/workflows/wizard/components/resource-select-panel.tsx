import { useState, useMemo } from 'react'
import { Search, X, Check } from 'lucide-react'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { cn } from '@/shared/lib/utils'

interface ResourceItem {
  id: string
  name: string
  enabled?: boolean
}

interface ResourceSelectPanelProps {
  items: ResourceItem[] | undefined
  selectedIds: string[]
  onToggle: (id: string, checked: boolean) => void
  onClear: () => void
  emptyMessage: string
  searchPlaceholder: string
}

export function ResourceSelectPanel({
  items,
  selectedIds,
  onToggle,
  onClear,
  emptyMessage,
  searchPlaceholder,
}: ResourceSelectPanelProps) {
  const [search, setSearch] = useState('')

  const enabledItems = useMemo(
    () => items?.filter((item) => item.enabled !== false) ?? [],
    [items]
  )

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  // Ordem estável: mantém a ordem original dos items, sem reordenar ao selecionar
  const filteredItems = useMemo(() => {
    if (!search.trim()) return enabledItems
    const q = search.toLowerCase()
    return enabledItems.filter((item) => item.name.toLowerCase().includes(q))
  }, [enabledItems, search])

  if (enabledItems.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">{emptyMessage}</p>
  }

  return (
    <div className="space-y-2">
      {/* Header: search + clear */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8 h-8 text-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {selectedIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[11px] text-muted-foreground shrink-0"
            onClick={onClear}
          >
            Limpar ({selectedIds.length})
          </Button>
        )}
      </div>

      {/* Item list — ordem estável, sem pular */}
      <ScrollArea className="h-[200px]">
        <div className="space-y-px pr-2">
          {filteredItems.map((item) => {
            const isSelected = selectedSet.has(item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id, !isSelected)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors',
                  isSelected
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-4 h-4 rounded-sm border shrink-0 transition-colors',
                  isSelected
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground/30'
                )}>
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <span className="truncate">{item.name}</span>
              </button>
            )
          })}
          {filteredItems.length === 0 && search && (
            <p className="text-[11px] text-muted-foreground py-3 text-center">
              Nenhum resultado para "{search}"
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
