import { useMemo } from 'react'
import { X } from 'lucide-react'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import {
  useSearchPagination,
  SearchBar,
  Pagination,
} from '@/shared/components/common/search-pagination'

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
  const enabledItems = useMemo(
    () => items?.filter((item) => item.enabled !== false) ?? [],
    [items]
  )

  const { paged, search, setSearch, page, setPage, totalPages, total } =
    useSearchPagination({
      data: enabledItems,
      searchFields: ['name'] as const,
      pageSize: 20,
    })

  const itemMap = useMemo(() => {
    const map = new Map<string, ResourceItem>()
    for (const item of enabledItems) map.set(item.id, item)
    return map
  }, [enabledItems])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const selectedItems = useMemo(
    () =>
      selectedIds
        .map((id) => itemMap.get(id))
        .filter((item): item is ResourceItem => !!item),
    [selectedIds, itemMap]
  )

  const sortedPage = useMemo(
    () =>
      [...paged].sort((a, b) => {
        const aSelected = selectedSet.has(a.id) ? 0 : 1
        const bSelected = selectedSet.has(b.id) ? 0 : 1
        return aSelected - bSelected
      }),
    [paged, selectedSet]
  )

  if (enabledItems.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">{emptyMessage}</p>
  }

  return (
    <div className="space-y-3">
      {selectedItems.length > 0 && (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Selecionados ({selectedItems.length}):
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={onClear}
              >
                Limpar
              </Button>
            </div>
            <ScrollArea className="max-h-[72px]">
              <div className="flex flex-wrap gap-1">
                {selectedItems.map((item) => (
                  <Badge
                    key={item.id}
                    variant="secondary"
                    className="text-xs gap-1 pr-1"
                  >
                    {item.name}
                    <button
                      type="button"
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                      onClick={() => onToggle(item.id, false)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </div>
          <Separator />
        </>
      )}

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder={searchPlaceholder}
        total={total}
      />

      <ScrollArea className="h-[280px]">
        <div className="grid grid-cols-2 gap-1.5 pr-3">
          {sortedPage.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-2 text-xs cursor-pointer px-2.5 py-2 rounded-md border hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={selectedSet.has(item.id)}
                onCheckedChange={(checked) => onToggle(item.id, !!checked)}
                className="h-3.5 w-3.5"
              />
              <span className="truncate">{item.name}</span>
            </label>
          ))}
        </div>
      </ScrollArea>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
