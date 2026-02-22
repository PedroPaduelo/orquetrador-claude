import { useState, useMemo, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'

export interface FilterDefinition<T> {
  key: string
  label: string
  options: { value: string; label: string }[]
  match: (item: T, value: string) => boolean
}

interface UseSearchPaginationOptions<T> {
  data: T[] | undefined
  searchFields: (keyof T)[]
  pageSize?: number
  filters?: FilterDefinition<T>[]
}

interface SearchPaginationResult<T> {
  filtered: T[]
  paged: T[]
  search: string
  setSearch: (s: string) => void
  page: number
  setPage: (p: number) => void
  totalPages: number
  total: number
  activeFilters: Record<string, string>
  setFilter: (key: string, value: string) => void
  clearFilters: () => void
  hasActiveFilters: boolean
}

export function useSearchPagination<T>({
  data,
  searchFields,
  pageSize = 12,
  filters: filterDefs = [],
}: UseSearchPaginationOptions<T>): SearchPaginationResult<T> {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})

  const setFilter = useCallback((key: string, value: string) => {
    setActiveFilters((prev) => {
      if (value === '__all__') {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: value }
    })
    setPage(1)
  }, [])

  const clearFilters = useCallback(() => {
    setActiveFilters({})
    setPage(1)
  }, [])

  const hasActiveFilters = Object.keys(activeFilters).length > 0

  const filtered = useMemo(() => {
    if (!data) return []
    let result = data

    // Apply filters
    for (const def of filterDefs) {
      const val = activeFilters[def.key]
      if (val) {
        result = result.filter((item) => def.match(item, val))
      }
    }

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((item) =>
        searchFields.some((field) => {
          const v = item[field]
          return typeof v === 'string' && v.toLowerCase().includes(q)
        })
      )
    }

    return result
  }, [data, search, searchFields, activeFilters, filterDefs])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  return {
    filtered,
    paged,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    page: safePage,
    setPage,
    totalPages,
    total: filtered.length,
    activeFilters,
    setFilter,
    clearFilters,
    hasActiveFilters,
  }
}

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  total?: number
}

export function SearchBar({ value, onChange, placeholder = 'Buscar...', total }: SearchBarProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 h-9"
        />
      </div>
      {total !== undefined && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{total} resultado(s)</span>
      )}
    </div>
  )
}

interface FilterBarProps<T> {
  filters: FilterDefinition<T>[]
  activeFilters: Record<string, string>
  onFilterChange: (key: string, value: string) => void
  onClear: () => void
  hasActive: boolean
}

export function FilterBar<T>({ filters, activeFilters, onFilterChange, onClear, hasActive }: FilterBarProps<T>) {
  if (filters.length === 0) return null
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((f) => (
        <Select key={f.key} value={activeFilters[f.key] || '__all__'} onValueChange={(v) => onFilterChange(f.key, v)}>
          <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs gap-1.5">
            <SelectValue placeholder={f.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {hasActive && (
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground" onClick={onClear}>
          <X className="h-3.5 w-3.5 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  )
}

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = getPageNumbers(page, totalPages)

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-1 text-muted-foreground text-sm">...</span>
        ) : (
          <Button
            key={p}
            variant={p === page ? 'default' : 'outline'}
            size="icon"
            className="h-8 w-8 text-xs"
            onClick={() => onPageChange(p as number)}
          >
            {p}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '...')[] = [1]

  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('...')

  pages.push(total)
  return pages
}
