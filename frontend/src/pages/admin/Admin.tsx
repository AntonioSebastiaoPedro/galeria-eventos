import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Copy, KeyRound, MessageCircle, Search } from 'lucide-react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import { Button, Card, Modal, PageHeader, Segmented, Spinner } from '../../components'
import { fmtLongDate, fmtPhone, fmtSize, whatsappLink } from '../../format'
import { usePaged } from '../../pagination'
import { toast } from '../../toast'
import type { ManagedEvent, Plan } from '../../types'
import { useDebounced } from '../../useDebounced'
import PlanRequests from './PlanRequests'

interface Overview { organizers: number; events: number; active_events: number; events_by_plan: Record<string, number>; media: number; videos: number; storage_used: number; pending_plan_requests: number }
interface AdminUser { id: number; name: string; email: string | null; phone: string | null; role: string; events_count: number; created_at: string; disabled: boolean }

type Tab = 'eventos' | 'pedidos' | 'contas'

// Administração da plataforma: visão geral, eventos (e o plano de cada um), pedidos de mudança de plano e contas.
export default function Admin() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = (['eventos', 'pedidos', 'contas'] as const).find((t) => t === params.get('separador')) ?? 'eventos'
  const setTab = (t: Tab) => setParams({ separador: t }, { replace: true })
  const overview = useQuery({ queryKey: ['admin-overview'], queryFn: () => api<Overview>('/admin/overview') })
  const o = overview.data

  return (
    <>
      <PageHeader title="Administração" />
      {o && (
        <dl className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[['Organizadores', o.organizers], ['Eventos', o.events], ['Activos', o.active_events], ['Conteúdos', o.media], ['Espaço usado', fmtSize(o.storage_used)]].map(([label, value], i) => (
            <div key={label} className={`min-w-0 rounded-2xl border border-line bg-paper p-4 ${i === 4 ? 'col-span-2 md:col-span-1' : ''}`}><dt className="text-xs font-semibold text-ink-2">{label}</dt><dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</dd></div>
          ))}
        </dl>
      )}
      <div className="mb-5"><Segmented full value={tab} onChange={setTab} options={[
        { value: 'eventos', label: 'Eventos' },
        { value: 'pedidos', label: 'Pedidos', count: o?.pending_plan_requests || undefined },
        { value: 'contas', label: 'Contas' },
      ]} /></div>
      {tab === 'eventos' ? <EventsTable /> : tab === 'pedidos' ? <PlanRequests /> : <UsersTable />}
    </>
  )
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-4 max-w-sm">
      <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-11 w-full rounded-xl border border-line bg-paper pl-10 pr-4 focus:border-ink focus:outline-none" />
    </div>
  )
}

function EventsTable() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<Plan[]>('/plans') }).data ?? []
  const { rows, isLoading, footer } = usePaged<ManagedEvent>('/admin/events', q ? { search: q } : {})
  const setPlan = useMutation({
    mutationFn: ({ id, plan }: { id: number; plan: string }) => api(`/admin/events/${id}/plan`, 'PUT', { plan }),
    onSuccess: () => { toast('Plano alterado.'); void qc.invalidateQueries({ queryKey: ['/admin/events'] }); void qc.invalidateQueries({ queryKey: ['admin-overview'] }) },
  })

  return (
    <>
      <SearchBox value={search} onChange={setSearch} placeholder="Procurar evento ou organizador" />
      {isLoading ? <Spinner /> : (<>
        {/* Telemóvel: um cartão por evento, sem tabela a deslizar para o lado. */}
        <ul className="space-y-3 md:hidden">
          {rows.map((e) => (
            <li key={e.id} className="rounded-2xl border border-line bg-paper p-4">
              <Link to={`/eventos/${e.id}`} className="block break-words font-semibold">{e.title}</Link>
              <p className="text-sm text-ink-3">{fmtLongDate(e.event_date)}{e.status === 'disabled' && ' · desactivado'}</p>
              <p className="mt-2 truncate text-sm">{e.owner?.name} <span className="text-ink-3">· {e.owner?.email ?? fmtPhone(e.owner?.phone)}</span></p>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                <p className="min-w-0 text-sm tabular-nums text-ink-2">{e.counts.photos + e.counts.videos} conteúdos{e.counts.pending > 0 && ` (+${e.counts.pending})`}<br />{fmtSize(e.counts.storage_used)} de {fmtSize(e.counts.storage_limit)}</p>
                <PlanSelect event={e} plans={plans} onChange={(plan) => setPlan.mutate({ id: e.id, plan })} />
              </div>
            </li>
          ))}
        </ul>
        <Card className="hidden overflow-x-auto p-0! md:block">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-3"><tr><th className="px-4 py-3">Evento</th><th className="px-4 py-3">Organizador</th><th className="px-4 py-3">Conteúdos</th><th className="px-4 py-3">Espaço</th><th className="px-4 py-3">Plano</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3"><Link to={`/eventos/${e.id}`} className="font-semibold hover:text-coral">{e.title}</Link><div className="text-ink-3">{fmtLongDate(e.event_date)}{e.status === 'disabled' && ' · desactivado'}</div></td>
                  <td className="px-4 py-3">{e.owner?.name}<div className="text-ink-3">{e.owner?.email ?? fmtPhone(e.owner?.phone)}</div></td>
                  <td className="px-4 py-3 tabular-nums">{e.counts.photos + e.counts.videos}{e.counts.pending > 0 && <span className="text-ink-3"> (+{e.counts.pending})</span>}</td>
                  <td className="px-4 py-3 tabular-nums">{fmtSize(e.counts.storage_used)} / {fmtSize(e.counts.storage_limit)}</td>
                  <td className="px-4 py-3"><PlanSelect event={e} plans={plans} onChange={(plan) => setPlan.mutate({ id: e.id, plan })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </>)}
      {footer}
    </>
  )
}

function PlanSelect({ event, plans, onChange }: { event: ManagedEvent; plans: Plan[]; onChange: (plan: string) => void }) {
  return (
    <select value={event.plan.key} aria-label={`Plano de ${event.title}`} onChange={(ev) => onChange(ev.target.value)} className="h-11 shrink-0 rounded-xl border border-line bg-paper px-3 text-base md:h-10 md:text-sm">
      {plans.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
    </select>
  )
}

function UsersTable() {
  const qc = useQueryClient()
  const { user: me } = useAuth()
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const { rows, isLoading, footer } = usePaged<AdminUser>('/admin/users', q ? { search: q } : {})
  const toggle = useMutation({
    mutationFn: (u: AdminUser) => api(`/admin/users/${u.id}/${u.disabled ? 'enable' : 'disable'}`, 'POST'),
    onSuccess: () => { toast('Conta actualizada.'); void qc.invalidateQueries({ queryKey: ['/admin/users'] }) },
  })
  // Contas sem e-mail não recuperam a senha sozinhas: a administração cria uma temporária e envia-a por WhatsApp.
  const [temporary, setTemporary] = useState<{ user: AdminUser; password: string } | null>(null)
  const reset = useMutation({
    mutationFn: (u: AdminUser) => api<{ password: string }>(`/admin/users/${u.id}/reset-password`, 'POST'),
    onSuccess: (r, u) => setTemporary({ user: u, password: r.password }),
  })

  return (
    <>
      <SearchBox value={search} onChange={setSearch} placeholder="Procurar nome, telemóvel ou e-mail" />
      {isLoading ? <Spinner /> : (
        <Card className="p-0!">
          <ul className="divide-y divide-line">
            {rows.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{u.name} {u.role === 'superadmin' && <span className="ml-1 rounded-full bg-wash px-2 py-0.5 text-xs">Administração</span>} {u.disabled && <span className="ml-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">Desactivada</span>}</p>
                  <p className="break-all text-sm text-ink-3">{[u.phone && fmtPhone(u.phone), u.email].filter(Boolean).join(' · ')} · {u.events_count} evento(s)</p>
                </div>
                {u.id !== me?.id && (
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" onClick={() => { if (confirm(`Criar uma senha temporária para ${u.name}? A senha actual deixa de funcionar.`)) reset.mutate(u) }}><KeyRound size={16} aria-hidden="true" />Repor senha</Button>
                    <Button variant={u.disabled ? 'soft' : 'ghost'} className={u.disabled ? '' : 'text-danger'} onClick={() => { if (u.disabled || confirm(`Desactivar a conta de ${u.name}? Perde logo o acesso.`)) toggle.mutate(u) }}>{u.disabled ? 'Reactivar' : 'Desactivar'}</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {footer}
      {temporary && (
        <Modal open onClose={() => setTemporary(null)} title="Senha temporária">
          <p className="-mt-2 mb-4 text-sm text-ink-2">Envie esta senha a {temporary.user.name}. Só aparece agora: depois de fechar, não a volta a ver. Peça-lhe para a mudar em Conta.</p>
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-night p-4 text-cream">
            <span className="font-mono text-2xl tracking-wider">{temporary.password}</span>
            <button type="button" aria-label="Copiar senha" onClick={() => { void navigator.clipboard.writeText(temporary.password); toast('Senha copiada.') }} className="flex size-11 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"><Copy size={18} /></button>
          </div>
          {temporary.user.phone && (
            <a href={whatsappLink(temporary.user.phone, `Olá ${temporary.user.name}! A sua senha temporária da Galeria é: ${temporary.password}\nEntre com o seu telemóvel e mude-a em Conta.`)} target="_blank" rel="noreferrer"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] font-semibold text-white"><MessageCircle size={20} aria-hidden="true" />Enviar por WhatsApp</a>
          )}
        </Modal>
      )}
    </>
  )
}
