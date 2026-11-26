import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalendarHeart, Image, Lock, Plus, Video } from 'lucide-react'
import { api } from '../../api'
import { buttonClass, EmptyState, PageHeader, Spinner } from '../../components'
import { EVENT_TYPES, fmtLongDate } from '../../format'
import type { ManagedEvent } from '../../types'

export default function Events() {
  const { data, isLoading } = useQuery({ queryKey: ['events'], queryFn: () => api<ManagedEvent[]>('/events') })

  return (
    <>
      <PageHeader title="Os seus eventos" actions={<Link to="/eventos/novo" className={buttonClass('coral')}><Plus size={18} aria-hidden="true" />Criar evento</Link>} />
      {isLoading ? <Spinner /> : !data?.length ? (
        <EmptyState icon={<CalendarHeart size={26} />} title="Ainda não criou nenhum evento" hint="Crie a galeria, imprima o QR Code e deixe os convidados partilharem as fotografias da festa."
          action={<Link to="/eventos/novo" className={buttonClass('coral')}>Criar o primeiro evento</Link>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((e, i) => (
            <li key={e.id} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
              <Link to={`/eventos/${e.id}`} className="group block overflow-hidden rounded-3xl border border-line bg-paper transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-ink/5">
                <div className="relative aspect-[16/9] bg-night">
                  {e.cover_url ? <img src={e.cover_url} alt="" className="size-full object-cover" /> : (
                    <div className="flex size-full items-end bg-[radial-gradient(circle_at_80%_20%,#e9b949_0,transparent_35%),radial-gradient(circle_at_20%_90%,#d9472b_0,transparent_45%)] p-4" />
                  )}
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    {e.status === 'disabled' && <span className="rounded-full bg-danger px-2.5 py-1 text-xs font-bold text-white">Desactivada</span>}
                    {e.visibility === 'private' && <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white"><Lock size={12} aria-hidden="true" />Privada</span>}
                    <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">{e.plan.name}</span>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm text-ink-3">{EVENT_TYPES[e.event_type]} · {fmtLongDate(e.event_date)}</p>
                  <h2 className="mt-1 font-display text-2xl font-semibold leading-tight group-hover:text-coral">{e.title}</h2>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-ink-2">
                    <span className="inline-flex items-center gap-1.5"><Image size={16} aria-hidden="true" />{e.counts.photos}</span>
                    <span className="inline-flex items-center gap-1.5"><Video size={16} aria-hidden="true" />{e.counts.videos}</span>
                    {e.counts.pending > 0 && <span className="rounded-full bg-gold px-2 text-xs font-bold leading-6 text-gold-ink">{e.counts.pending} por aprovar</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
