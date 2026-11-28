import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { api } from '../../api'
import { buttonClass, EmptyState, Spinner } from '../../components'
import { EVENT_TYPES, fmtLongDate } from '../../format'
import type { ManagedEvent } from '../../types'

// Cabeçalho e separadores de um evento. Avisos em tempo real (Reverb) actualizam as listas quando chegam envios.
export default function EventShell() {
  const { id } = useParams()
  const qc = useQueryClient()
  const event = useQuery({ queryKey: ['event', id], queryFn: () => api<ManagedEvent>(`/events/${id}`) })

  // O cliente do Reverb só é carregado aqui: a galeria dos convidados não precisa dele.
  useEffect(() => {
    if (!id) return
    let leave: (() => void) | null = null
    let cancelled = false
    import('../../echo').then(({ echo }) => {
      if (cancelled) return
      echo().private(`events.${id}`).listen('.media.changed', () => {
        void qc.invalidateQueries({ queryKey: ['event', id] })
        void qc.invalidateQueries({ queryKey: [`/events/${id}/media`] })
        void qc.invalidateQueries({ queryKey: ['event-stats', id] })
      })
      leave = () => echo().leave(`events.${id}`)
    }).catch(() => { /* sem tempo real: as listas actualizam-se ao navegar */ })
    return () => { cancelled = true; leave?.() }
  }, [id, qc])

  if (event.isLoading) return <Spinner />
  if (!event.data) return <EmptyState title="Evento não encontrado" action={<Link to="/eventos" className={buttonClass('soft')}>Voltar aos eventos</Link>} />
  const e = event.data

  const tabs = [
    { to: '', label: 'Resumo', end: true },
    { to: 'conteudos', label: 'Conteúdos', badge: e.counts.pending },
    { to: 'convidados', label: 'Convidados' },
    { to: 'definicoes', label: 'Definições' },
  ]

  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-3 md:mb-6 md:items-end">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-coral">{EVENT_TYPES[e.event_type]} · {fmtLongDate(e.event_date)}</p>
          <h1 className="break-words font-display text-[1.75rem] font-semibold leading-tight md:text-[2.75rem]">{e.title}</h1>
          {e.status === 'disabled' && <p className="mt-1 text-sm font-semibold text-danger">Galeria desactivada: os convidados não a conseguem abrir.</p>}
        </div>
        <Link to={`/g/${e.slug}`} aria-label="Ver galeria" title="Ver galeria" className={buttonClass('soft', 'w-11 shrink-0 px-0! sm:w-auto sm:px-5!')}><Eye size={18} aria-hidden="true" /><span className="hidden sm:inline">Ver galeria</span></Link>
      </div>
      {/* No telemóvel: os quatro separadores repartem a largura e ficam presos por baixo do cabeçalho. */}
      <nav aria-label="Secções do evento" className="sticky top-14 z-20 -mx-4 mb-5 grid grid-cols-4 border-b border-line bg-canvas/95 px-1 backdrop-blur md:static md:mx-0 md:mb-6 md:flex md:gap-1 md:bg-transparent md:px-0 md:backdrop-blur-none">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => `relative -mb-px flex h-12 min-w-0 items-center justify-center gap-1 border-b-2 px-1 text-[0.8125rem] font-semibold md:h-11 md:justify-start md:gap-2 md:px-3 md:text-sm ${isActive ? 'border-coral text-ink' : 'border-transparent text-ink-3 hover:text-ink'}`}>
            <span className="truncate">{t.label}</span>{!!t.badge && <span className="shrink-0 rounded-full bg-gold px-1.5 text-[0.7rem] leading-5 text-gold-ink md:text-xs">{t.badge}</span>}
          </NavLink>
        ))}
      </nav>
      <Outlet context={e} />
    </>
  )
}
