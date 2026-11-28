import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, CircleAlert, Clock, Copy, FileText, Paperclip, Sparkles } from 'lucide-react'
import { api, upload } from '../../api'
import { Button, Card, ErrorText, Meter, Modal } from '../../components'
import { fmtDateTime, fmtKz, fmtPhone, fmtSize, whatsappLink } from '../../format'
import { preparePhoto } from '../../image'
import { toast } from '../../toast'
import type { Plan, PlanRequest, PlanRequestInfo } from '../../types'
import { useEvent } from './useEvent'

const features = (p: Plan) => [
  `${fmtSize(p.storage_mb * 1024 * 1024)} de espaço`,
  p.max_photos ? `até ${p.max_photos} fotografias` : 'fotografias sem limite',
  p.videos ? 'vídeos' : 'sem vídeos',
  p.zip && 'ZIP com tudo',
].filter(Boolean).join(' · ')

// Plano do evento, espaço usado e mudança de plano: paga-se a diferença por Multicaixa Express e envia-se o comprovativo.
export default function PlanCard() {
  const e = useEvent()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const info = useQuery({ queryKey: ['plan-request', e.id], queryFn: () => api<PlanRequestInfo>(`/events/${e.id}/plan-request`) })
  const current = info.data?.current
  const pending = current?.status === 'pending'

  const cancel = useMutation({
    mutationFn: (r: PlanRequest) => api(`/plan-requests/${r.id}`, 'DELETE'),
    onSuccess: () => { toast('Pedido cancelado.'); void qc.invalidateQueries({ queryKey: ['plan-request', e.id] }) },
  })

  return (
    <Card>
      <h2 className="text-lg font-bold">Plano {e.plan.name}</h2>
      <p className="text-sm text-ink-2">{features(e.plan)}</p>
      <div className="mt-5"><Meter label={`${fmtSize(e.counts.storage_used)} de ${fmtSize(e.counts.storage_limit)}`} value={e.counts.storage_used} max={e.counts.storage_limit} /></div>

      {pending && current && (
        <div className="mt-4 rounded-2xl bg-gold/25 p-4 text-gold-ink">
          <p className="flex items-center gap-2 font-semibold"><Clock size={18} aria-hidden="true" />Pedido do plano {current.to_plan_name} enviado</p>
          <p className="mt-1 text-sm">Estamos a confirmar o pagamento de {fmtKz(current.amount_kz)} (pedido em {fmtDateTime(current.created_at)}). O plano muda assim que for confirmado.</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
            {current.proof_url && <a href={current.proof_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">Ver comprovativo</a>}
            <button type="button" className="underline underline-offset-4" disabled={cancel.isPending} onClick={() => { if (confirm('Cancelar o pedido? Se já pagou, fale com a equipa da Galeria.')) cancel.mutate(current) }}>Cancelar pedido</button>
          </div>
        </div>
      )}
      {current?.status === 'rejected' && (
        <div className="mt-4 rounded-2xl bg-danger-soft p-4 text-danger">
          <p className="flex items-center gap-2 font-semibold"><CircleAlert size={18} aria-hidden="true" />Pedido do plano {current.to_plan_name} recusado</p>
          {current.admin_note && <p className="mt-1 text-sm">Motivo: {current.admin_note}</p>}
        </div>
      )}
      {current?.status === 'approved' && current.to_plan === e.plan.key && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-leaf-soft p-4 text-sm font-semibold text-leaf"><Check size={18} aria-hidden="true" />Plano {current.to_plan_name} activado{current.reviewed_at && ` em ${fmtDateTime(current.reviewed_at)}`}.</p>
      )}

      {info.data && !pending && (info.data.upgrades.length ? (
        <Button className="mt-4 w-full sm:w-auto" variant="coral" onClick={() => setOpen(true)}><Sparkles size={18} aria-hidden="true" />Mudar de plano</Button>
      ) : <p className="mt-4 text-sm text-ink-2">Este evento já está no plano mais completo.</p>)}

      {open && info.data && <UpgradeDialog info={info.data} onClose={() => setOpen(false)} />}
    </Card>
  )
}

function UpgradeDialog({ info, onClose }: { info: PlanRequestInfo; onClose: () => void }) {
  const e = useEvent()
  const qc = useQueryClient()
  const [plan, setPlan] = useState<PlanRequestInfo['upgrades'][number] | null>(null)
  const [proof, setProof] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<unknown>(null)
  const pay = info.payment

  const submit = async () => {
    if (!plan || !proof) return
    setError(null)
    setProgress(0)
    try {
      const file = proof.type.startsWith('image/') ? await preparePhoto(proof, info.proof_max_mb * 1024 * 1024) : proof
      const form = new FormData()
      form.append('plan', plan.key)
      form.append('proof', file)
      await upload(`/events/${e.id}/plan-request`, form, setProgress)
      toast('Pedido enviado. Avisamos assim que o pagamento for confirmado.')
      void qc.invalidateQueries({ queryKey: ['plan-request', e.id] })
      onClose()
    } catch (err) { setError(err) } finally { setProgress(null) }
  }
  const copyNumber = async () => { if (pay) { await navigator.clipboard.writeText(pay.number.replace(/\s/g, '')); toast('Número copiado.') } }

  return (
    <Modal open onClose={onClose} title={plan ? `Plano ${plan.name}` : 'Mudar de plano'} wide>
      {!pay ? (
        <div className="rounded-2xl bg-wash p-4 text-sm">
          <p className="font-semibold">Os pagamentos ainda não estão disponíveis na aplicação.</p>
          {info.support_phone && <p className="mt-1">Fale connosco pelo <a className="font-semibold underline underline-offset-4" href={whatsappLink(info.support_phone, `Olá! Quero mudar o plano do evento "${e.title}".`)} target="_blank" rel="noreferrer">WhatsApp ({fmtPhone(info.support_phone)})</a>.</p>}
        </div>
      ) : !plan ? (
        <>
          <p className="-mt-2 mb-4 text-sm text-ink-2">Paga só a diferença para o plano {e.plan.name}. O novo plano fica activo assim que confirmarmos o pagamento.</p>
          <ul className="space-y-2">
            {info.upgrades.map((p) => (
              <li key={p.key}>
                <button type="button" onClick={() => setPlan(p)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line p-4 text-left transition hover:border-ink active:scale-[0.99]">
                  <span className="min-w-0">
                    <span className="block font-display text-xl font-semibold">{p.name}</span>
                    <span className="mt-0.5 block text-sm text-ink-2">{features(p)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-xs text-ink-3">A pagar</span>
                    <span className="block font-semibold tabular-nums">{fmtKz(p.amount_kz)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <ol className="space-y-5">
            <li>
              <p className="font-semibold">1. Envie {fmtKz(plan.amount_kz)} por {pay.method}</p>
              {plan.amount_kz !== plan.price_kz && <p className="text-sm text-ink-3">Preço do plano {plan.name}: {fmtKz(plan.price_kz)}; o plano {e.plan.name} já está pago.</p>}
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-night p-4 text-cream">
                <div className="min-w-0">
                  <p className="text-xs text-cream/60">Número</p>
                  <p className="font-display text-2xl font-semibold tabular-nums">{fmtPhone(pay.number)}</p>
                  {pay.holder && <p className="truncate text-sm text-cream/70">{pay.holder}</p>}
                </div>
                <button type="button" onClick={copyNumber} aria-label="Copiar número" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"><Copy size={18} /></button>
              </div>
            </li>
            <li>
              <p className="font-semibold">2. Anexe o comprovativo</p>
              <p className="text-sm text-ink-3">Uma captura de ecrã ou o PDF do Multicaixa Express (até {info.proof_max_mb} MB).</p>
              <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-line p-4 hover:border-ink">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-wash">{proof ? <FileText size={20} aria-hidden="true" /> : <Paperclip size={20} aria-hidden="true" />}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{proof ? proof.name : 'Escolher o comprovativo'}</span>
                  <span className="block text-sm text-ink-3">{proof ? `${fmtSize(proof.size)} · tocar para trocar` : 'Imagem ou PDF'}</span>
                </span>
                <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(ev) => { setProof(ev.target.files?.[0] ?? null); setError(null) }} />
              </label>
            </li>
          </ol>
          <div className="mt-5"><ErrorText error={error} /></div>
          <div className="mt-2 flex gap-2">
            <Button variant="soft" onClick={() => { setPlan(null); setError(null) }} disabled={progress !== null}><ArrowLeft size={18} aria-hidden="true" />Voltar</Button>
            <Button variant="coral" className="flex-1" disabled={!proof || progress !== null} onClick={() => void submit()}>
              {progress !== null ? `A enviar… ${Math.round(progress * 100)}%` : 'Enviar pedido'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
