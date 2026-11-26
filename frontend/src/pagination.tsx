import { useCallback, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { api } from './api'
import { useMediaQuery } from './useMediaQuery'

export interface Paged<T> { data: T[]; current_page: number; last_page: number; per_page: number; total: number }

export const PAGE_SIZES = [10, 25, 50, 100]
const STORAGE_KEY = 'galeria.perPage'

function storedSize() {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY))
    return PAGE_SIZES.includes(n) ? n : 25
  } catch {
    return 25
  }
}

// Listagem paginada: páginas com botões no ecrã grande, scroll infinito no telemóvel.
// A chave começa por `path`, por isso invalidar ['/admin/…'] também atualiza estas listas.
export function usePaged<T>(path: string, params: Record<string, string> = {}) {
  const mobile = useMediaQuery('(max-width: 767px)')
  const [perPage, setPerPageState] = useState(storedSize)
  const extra = JSON.stringify(params)
  // A página pertence a uma pesquisa e a um tamanho: se um deles muda, volta à primeira sem efeitos.
  const scope = `${path}|${extra}|${perPage}`
  const [at, setAt] = useState({ scope, page: 1 })
  const page = at.scope === scope ? at.page : 1
  const setPage = (n: number) => setAt({ scope, page: n })

  const url = (p: number) => `${path}?${new URLSearchParams({ ...params, page: String(p), per_page: String(perPage) })}`

  const paged = useQuery({
    queryKey: [path, 'paged', extra, perPage, page],
    queryFn: () => api<Paged<T>>(url(page)),
    enabled: !mobile,
    // Mantém a página anterior enquanto carrega a seguinte, mas nunca as linhas de outro recurso (têm outra forma).
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[0] === path ? prev : undefined),
  })
  const infinite = useInfiniteQuery({
    queryKey: [path, 'infinite', extra, perPage],
    queryFn: ({ pageParam }) => api<Paged<T>>(url(pageParam)),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
    enabled: mobile,
  })

  // Se a página atual ficou vazia (apagaram-se registos), recua para a última.
  const lastPage = paged.data?.last_page
  if (lastPage && page > lastPage) setAt({ scope, page: lastPage })

  const setPerPage = (n: number) => {
    setPerPageState(n)
    try { localStorage.setItem(STORAGE_KEY, String(n)) } catch { /* sem armazenamento: só não se lembra */ }
  }

  const q = mobile ? infinite : paged
  const rows = mobile ? (infinite.data?.pages.flatMap((p) => p.data) ?? []) : (paged.data?.data ?? [])
  const total = (mobile ? infinite.data?.pages[0] : paged.data)?.total

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = infinite
  const sentinel = useCallback((el: HTMLElement | null) => {
    if (!el) return
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) void fetchNextPage() }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [fetchNextPage])

  const footer = total === undefined || total === 0 ? null : mobile ? (
    <div className="mt-3 flex flex-col items-center gap-3">
      {hasNextPage && <div key={rows.length} ref={sentinel} className="h-1 w-full" aria-hidden="true" />}
      {isFetchingNextPage && <Loader2 size={20} className="animate-spin text-ink-3" aria-label="A carregar mais" />}
      <div className="flex w-full items-center justify-between text-sm text-ink-3">
        <span className="tabular-nums">{rows.length} de {total}</span>
        <PerPage value={perPage} onChange={setPerPage} />
      </div>
    </div>
  ) : (
    <nav aria-label="Paginação" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-2">
      <span className="tabular-nums">{(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} de {total}</span>
      <div className="flex items-center gap-4">
        <PerPage value={perPage} onChange={setPerPage} />
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Página anterior"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line hover:bg-wash disabled:pointer-events-none disabled:opacity-40"><ChevronLeft size={18} aria-hidden="true" /></button>
          <span className="min-w-20 text-center tabular-nums">Página {page} de {paged.data?.last_page ?? 1}</span>
          <button onClick={() => setPage(page + 1)} disabled={page >= (paged.data?.last_page ?? 1)} aria-label="Página seguinte"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line hover:bg-wash disabled:pointer-events-none disabled:opacity-40"><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      </div>
    </nav>
  )

  return { rows, total, isLoading: q.isLoading, error: q.error, footer }
}

function PerPage({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span>Por página</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-10 rounded-xl border border-line bg-paper px-2 text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20">
        {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  )
}
