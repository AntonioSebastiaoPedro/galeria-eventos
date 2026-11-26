import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, FileDown, Image, KeyRound, Loader2, Share2, Users, Video } from 'lucide-react'
import { api } from '../../api'
import { Button, Card, Meter } from '../../components'
import { fmtDateTime, fmtKz, fmtSize, plural } from '../../format'
import { downloadCardPdf, downloadCardPng } from '../../qrCard'
import { notifyError, toast } from '../../toast'
import type { Export } from '../../types'
import { useEvent } from './useEvent'

interface Stats {
  guests: number
  blocked_guests: number
  contributors: number
  top_contributors: { name: string; total: number; photos: number; videos: number }[]
  by_day: { day: string; total: number }[]
}

export default function EventOverview() {
  const e = useEvent()
  const qc = useQueryClient()
  const qr = useQuery({ queryKey: ['event-qr', e.id, e.guest_url], queryFn: () => api<{ url: string; qr_png: string }>(`/events/${e.id}/qr`) })
  const stats = useQuery({ queryKey: ['event-stats', String(e.id)], queryFn: () => api<Stats>(`/events/${e.id}/stats`) })

  const regenerate = useMutation({
    mutationFn: () => api(`/events/${e.id}/regenerate-key`, 'POST'),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['event', String(e.id)] }); toast('Novo link criado. O anterior e os QR Codes impressos deixaram de funcionar.') },
  })

  const card = qr.data && { title: e.title, event_type: e.event_type, event_date: e.event_date, qr_png: qr.data.qr_png, url: qr.data.url }
  const copy = async () => { await navigator.clipboard.writeText(e.guest_url); toast('Link copiado.') }
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: e.title, text: 'Partilhe as suas fotografias e vídeos do evento:', url: e.guest_url })
      else await copy()
    } catch { /* cancelado */ }
  }
  const max = Math.max(1, ...(stats.data?.by_day.map((d) => d.total) ?? [1]))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <Card className="bg-night text-cream">
        <h2 className="text-lg font-bold">Link e QR Code</h2>
        <p className="mt-1 text-sm text-cream/70">Imprima o cartão e coloque-o nas mesas, na entrada ou no convite.{e.visibility === 'private' && ' O link e o QR Code levam a chave da galeria privada: partilhe-os só com os convidados.'}</p>
        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="flex size-44 shrink-0 items-center justify-center rounded-2xl bg-white p-2">
            {qr.data ? <img src={qr.data.qr_png} alt="QR Code da galeria" className="size-full [image-rendering:pixelated]" /> : <Loader2 className="animate-spin text-ink-3" />}
          </div>
          <div className="w-full min-w-0 space-y-2">
            <div className="flex items-center gap-2 rounded-xl bg-white/10 p-1 pl-3">
              <span className="min-w-0 flex-1 truncate font-mono text-sm">{e.guest_url}</span>
              <button onClick={copy} aria-label="Copiar link" className="flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/15"><Copy size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="light" disabled={!card} onClick={() => card && downloadCardPdf(card).catch(notifyError)}><FileDown size={18} aria-hidden="true" />PDF</Button>
              <Button variant="light" disabled={!card} onClick={() => card && downloadCardPng(card).catch(notifyError)}><Download size={18} aria-hidden="true" />Imagem</Button>
            </div>
            <Button variant="coral" className="w-full" onClick={share}><Share2 size={18} aria-hidden="true" />Enviar o link aos convidados</Button>
            {e.visibility === 'private' && (
              <button onClick={() => { if (confirm('Criar um novo link? O link actual e os QR Codes já impressos deixam de funcionar, e quem já entrou terá de entrar de novo.')) regenerate.mutate() }}
                className="inline-flex items-center gap-1.5 pt-1 text-sm font-semibold text-cream/70 underline underline-offset-4 hover:text-cream">
                <KeyRound size={14} aria-hidden="true" />O link chegou a quem não devia? Criar um novo
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Participação</h2>
        <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { icon: Image, label: 'Fotografias', value: e.counts.photos },
            { icon: Video, label: 'Vídeos', value: e.counts.videos },
            { icon: Users, label: 'Pessoas', value: stats.data?.contributors ?? 0 },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="min-w-0 rounded-2xl bg-wash p-3 sm:p-4">
              <dt className="flex flex-col gap-1 text-xs font-semibold text-ink-2 sm:flex-row sm:items-center sm:gap-1.5"><Icon size={16} aria-hidden="true" /><span className="truncate">{label}</span></dt>
              <dd className="mt-1 font-display text-[1.75rem] font-semibold leading-tight tabular-nums sm:text-3xl">{value}</dd>
            </div>
          ))}
        </dl>
        {e.counts.pending > 0 && <p className="mt-3 rounded-xl bg-gold/30 px-3 py-2 text-sm font-semibold text-gold-ink">{plural(e.counts.pending, 'conteúdo espera', 'conteúdos esperam')} pela sua aprovação.</p>}
        {!!stats.data?.by_day.length && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">Envios por dia <span className="font-normal text-ink-3">(dia do mês)</span></h3>
            <div className="flex h-24 items-end gap-1 sm:gap-1.5" role="img" aria-label={stats.data.by_day.map((d) => `${d.day}: ${d.total}`).join(', ')}>
              {stats.data.by_day.slice(-14).map((d) => (
                <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div className="w-full max-w-10 rounded-t-md bg-coral" style={{ height: `${(d.total / max) * 80}px` }} title={`${d.total}`} />
                  <span className="text-[0.65rem] tabular-nums text-ink-3">{Number(d.day.slice(8))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {!!stats.data?.top_contributors.length && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">Quem mais partilhou</h3>
            <ol className="divide-y divide-line">
              {stats.data.top_contributors.slice(0, 5).map((c, i) => (
                <li key={c.name} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate"><span className="mr-2 tabular-nums text-ink-3">{i + 1}.</span>{c.name}</span>
                  <span className="shrink-0 tabular-nums text-ink-2">{c.total}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Plano {e.plan.name}</h2>
            <p className="text-sm text-ink-2">{fmtKz(e.plan.price_kz)} · {e.plan.videos ? 'fotografias e vídeos' : 'só fotografias'}{e.plan.max_photos ? ` · até ${e.plan.max_photos} fotografias` : ''}{e.plan.zip ? ' · ZIP' : ''}</p>
          </div>
        </div>
        <div className="mt-5"><Meter label={`${fmtSize(e.counts.storage_used)} de ${fmtSize(e.counts.storage_limit)}`} value={e.counts.storage_used} max={e.counts.storage_limit} /></div>
        {e.plan.key === 'free' || e.counts.storage_used / e.counts.storage_limit > 0.8 ? (
          <p className="mt-4 text-sm text-ink-2">Precisa de mais espaço, de vídeos ou do ZIP? Fale com a equipa da Galeria para mudar o plano deste evento.</p>
        ) : null}
      </Card>

      <ExportCard />
    </div>
  )
}

// Descarregar tudo em ZIP: o pedido vai para a fila e a página acompanha até estar pronto.
function ExportCard() {
  const e = useEvent()
  const qc = useQueryClient()
  const latest = useQuery({
    queryKey: ['event-export', e.id],
    queryFn: () => api<Export | null>(`/events/${e.id}/export`),
    refetchInterval: (q) => (q.state.data && ['queued', 'processing'].includes(q.state.data.status) ? 3000 : false),
  })
  const start = useMutation({
    mutationFn: () => api<Export>(`/events/${e.id}/export`, 'POST'),
    onSuccess: (x) => qc.setQueryData(['event-export', e.id], x),
  })
  const x = latest.data
  const working = x && ['queued', 'processing'].includes(x.status)

  return (
    <Card>
      <h2 className="text-lg font-bold">Descarregar tudo</h2>
      {!e.plan.zip ? (
        <p className="mt-1 text-sm text-ink-2">O plano {e.plan.name} não inclui o ZIP com todas as fotografias e vídeos. Pode descarregar cada um na galeria ou em Conteúdos.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-2">Um ZIP com os originais de tudo o que está publicado. Fica disponível durante 7 dias.</p>
          {x?.status === 'ready' && (
            <a href={`/api/exports/${x.id}/download`} className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-leaf-soft p-4 text-leaf hover:brightness-95">
              <span><span className="block font-semibold">ZIP pronto · {plural(x.items ?? 0, 'ficheiro', 'ficheiros')}, {fmtSize(x.file_size ?? 0)}</span><span className="text-sm">Pedido em {fmtDateTime(x.created_at)}</span></span>
              <Download size={22} aria-hidden="true" />
            </a>
          )}
          {x?.status === 'failed' && <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">Não foi possível criar o ZIP. Tente outra vez.</p>}
          <Button className="mt-4" variant={x?.status === 'ready' ? 'soft' : 'primary'} disabled={!!working || start.isPending} onClick={() => start.mutate()}>
            {working ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" />A preparar o ZIP…</> : x?.status === 'ready' ? 'Criar um ZIP actualizado' : 'Preparar o ZIP'}
          </Button>
        </>
      )}
    </Card>
  )
}
