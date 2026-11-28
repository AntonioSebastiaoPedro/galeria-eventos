import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Check, FileText, MessageCircle, X } from 'lucide-react'
import { api } from '../../api'
import { Button, EmptyState, ErrorText, Modal, Segmented, Spinner, TextArea } from '../../components'
import { fmtDateTime, fmtKz, fmtPhone, whatsappLink } from '../../format'
import { usePaged } from '../../pagination'
import { toast } from '../../toast'
import type { PlanRequest } from '../../types'

interface AdminPlanRequest extends PlanRequest {
  event: { id: number; title: string; slug: string; plan: string } | null
  user: { id: number; name: string; email: string | null; phone: string | null } | null
}

type Status = 'pending' | 'approved' | 'rejected'

// Pedidos de mudança de plano: ver o comprovativo, confirmar no Multicaixa Express que o valor chegou e aprovar
// (o plano do evento muda logo) ou recusar com o motivo, que o organizador vê no evento.
export default function PlanRequests() {
  const qc = useQueryClient()
  const [status, setStatus] = useState<Status>('pending')
  const [rejecting, setRejecting] = useState<AdminPlanRequest | null>(null)
  const { rows, isLoading, footer } = usePaged<AdminPlanRequest>('/admin/plan-requests', { status })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['/admin/plan-requests'] })
    void qc.invalidateQueries({ queryKey: ['admin-overview'] })
    void qc.invalidateQueries({ queryKey: ['/admin/events'] })
  }
  const approve = useMutation({
    mutationFn: (r: AdminPlanRequest) => api(`/admin/plan-requests/${r.id}/approve`, 'POST'),
    onSuccess: () => { toast('Pagamento confirmado: o plano do evento já mudou.'); refresh() },
  })

  return (
    <>
      <div className="mb-4"><Segmented full value={status} onChange={setStatus} options={[{ value: 'pending', label: 'Por confirmar' }, { value: 'approved', label: 'Aprovados' }, { value: 'rejected', label: 'Recusados' }]} /></div>
      {isLoading ? <Spinner /> : !rows.length ? (
        <EmptyState title={status === 'pending' ? 'Nenhum pedido por confirmar' : 'Nada por aqui'} hint={status === 'pending' ? 'Os pedidos aparecem aqui quando um organizador envia o comprovativo.' : undefined} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-line bg-paper p-4">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  {r.event ? <Link to={`/eventos/${r.event.id}`} className="block break-words font-semibold hover:text-coral">{r.event.title}</Link> : <span className="font-semibold">Evento apagado</span>}
                  <p className="text-sm text-ink-2">{r.from_plan_name} → <b>{r.to_plan_name}</b></p>
                </div>
                <p className="font-display text-2xl font-semibold tabular-nums">{fmtKz(r.amount_kz)}</p>
              </div>
              <p className="mt-2 text-sm text-ink-2">
                {r.user?.name ?? 'Conta apagada'}
                {r.user?.phone && <> · <a className="underline underline-offset-2" href={whatsappLink(r.user.phone, `Olá! Sobre o pedido do plano ${r.to_plan_name} para "${r.event?.title ?? ''}":`)} target="_blank" rel="noreferrer">{fmtPhone(r.user.phone)}</a></>}
                {r.user?.email && <> · {r.user.email}</>}
              </p>
              <p className="text-xs text-ink-3">Pedido em {fmtDateTime(r.created_at)}{r.reviewed_at && ` · tratado em ${fmtDateTime(r.reviewed_at)}`}</p>
              {r.admin_note && <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">Motivo: {r.admin_note}</p>}

              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {r.proof_url && <a href={r.proof_url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-4 font-semibold hover:bg-wash md:h-10"><FileText size={18} aria-hidden="true" />Comprovativo</a>}
                {r.status === 'pending' && (
                  <>
                    <Button variant="primary" disabled={approve.isPending} onClick={() => { if (confirm(`Confirma que recebeu ${fmtKz(r.amount_kz)} no Multicaixa Express? O evento passa logo ao plano ${r.to_plan_name}.`)) approve.mutate(r) }}><Check size={18} aria-hidden="true" />Aprovar</Button>
                    <Button variant="ghost" className="text-danger" onClick={() => setRejecting(r)}><X size={18} aria-hidden="true" />Recusar</Button>
                  </>
                )}
                {r.status !== 'pending' && r.user?.phone && (
                  <a href={whatsappLink(r.user.phone, r.status === 'approved' ? `Olá! O plano ${r.to_plan_name} do evento "${r.event?.title ?? ''}" já está activo.` : `Olá! O pedido do plano ${r.to_plan_name} foi recusado: ${r.admin_note ?? ''}`)} target="_blank" rel="noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-xl px-4 font-semibold text-leaf hover:bg-wash md:h-10"><MessageCircle size={18} aria-hidden="true" />Avisar no WhatsApp</a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {footer}
      {rejecting && <RejectDialog request={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); refresh() }} />}
    </>
  )
}

function RejectDialog({ request, onClose, onDone }: { request: AdminPlanRequest; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const reject = useMutation({
    mutationFn: () => api(`/admin/plan-requests/${request.id}/reject`, 'POST', { reason }),
    onSuccess: () => { toast('Pedido recusado. O organizador vê o motivo no evento.'); onDone() },
  })
  return (
    <Modal open onClose={onClose} title="Recusar o pedido">
      <form onSubmit={(e) => { e.preventDefault(); reject.mutate() }}>
        <TextArea label="Motivo" hint="O organizador vê este texto no evento (e por e-mail, se tiver)." placeholder="Ex.: o valor recebido foi 5 000 Kz, faltam 2 000 Kz." value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={500} />
        <ErrorText error={reject.error} />
        <Button variant="danger" className="w-full" disabled={reject.isPending}>Recusar pedido</Button>
      </form>
    </Modal>
  )
}
