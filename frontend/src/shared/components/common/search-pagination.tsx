import { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'

interface UseSearchPaginationOptions<T> {
  data: T[] | undefined
  searchFields: (keyof T)[]
  pageSize?: number
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
}

export function useSearchPagination<T>({
  data,
  searchFields,
  pageSize = 12,
}: UseSearchPaginationOptions<T>): SearchPaginationResult<T> {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!data) return []
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter((item) =>
      searchFields.some((field) => {
        const val = item[field]
        return typeof val === 'string' && val.toLowerCase().includes(q)
      })
    )
  }, [data, search, searchFields])

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
