import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileDown, Image, KeyRound, LayoutGrid, Loader2, Share2, Users, Video } from 'lucide-react'
import { api } from '../../api'
import { Button, Card, Field, Modal } from '../../components'
import { fmtDateTime, fmtSize, plural } from '../../format'
import { downloadCardPdf, downloadCardPng, downloadSheetsPdf, MAX_CARDS, PER_SHEET } from '../../qrCard'
import { notifyError, toast } from '../../toast'
import type { Export } from '../../types'
import { ShareSheet, type ShareSubject } from '../../share'
import PlanCard from './PlanCard'
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
  const [sharing, setSharing] = useState<ShareSubject | null>(null)
  const [sheets, setSheets] = useState(false)
  const share = () => setSharing({
    kind: 'link', url: e.guest_url, title: e.title, text: `Partilhe as suas fotografias e vídeos de ${e.title}:`,
    warning: e.visibility === 'private' ? 'Este link leva a chave da galeria privada: quem o receber entra. Envie-o em conversas, não em publicações públicas.' : undefined,
  })
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
            <p className="truncate font-mono text-sm text-cream/70">{e.guest_url}</p>
            <Button variant="light" className="w-full" disabled={!card} onClick={() => setSheets(true)}><LayoutGrid size={18} aria-hidden="true" />Cartões para as mesas (A4)</Button>
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

      <PlanCard />

      <ExportCard />
      <ShareSheet subject={sharing} onClose={() => setSharing(null)} />
      {sheets && card && <SheetsDialog card={card} onClose={() => setSheets(false)} />}
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

// Vários cartões com o QR em folhas A4 (9 por folha, 3 × 3) para imprimir, cortar e pôr nas mesas.
function SheetsDialog({ card, onClose }: { card: Parameters<typeof downloadSheetsPdf>[0]; onClose: () => void }) {
  const [count, setCount] = useState('9')
  const [busy, setBusy] = useState(false)
  const n = Math.min(MAX_CARDS, Math.max(0, Math.floor(Number(count) || 0)))
  const sheets = Math.ceil(n / PER_SHEET)
  const spare = sheets * PER_SHEET - n
  const download = async () => {
    setBusy(true)
    try {
      await downloadSheetsPdf(card, n)
      toast(`PDF com ${plural(n, 'cartão', 'cartões')} pronto.`)
      onClose()
    } catch (err) { notifyError(err) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Cartões para as mesas">
      <form onSubmit={(ev) => { ev.preventDefault(); if (n) void download() }}>
        <p className="mb-4 text-sm text-ink-2">Cada folha A4 leva até {PER_SHEET} cartões com o QR Code, em 3 filas de 3. Imprima, corte pelas linhas tracejadas e coloque um em cada mesa.</p>
        <Field label="Quantos cartões?" type="number" inputMode="numeric" min={1} max={MAX_CARDS} step={1} required value={count} onChange={(ev) => setCount(ev.target.value)}
          hint={`Por exemplo, um por mesa. Máximo ${MAX_CARDS}.`} />
        <div className="mb-4 flex flex-wrap gap-2">
          {[9, 18, 27, 45].map((v) => (
            <button key={v} type="button" onClick={() => setCount(String(v))}
              className={`h-10 rounded-full border px-4 text-sm font-semibold ${n === v ? 'border-coral bg-coral text-white' : 'border-line hover:bg-wash'}`}>{v}</button>
          ))}
        </div>
        <p className="mb-4 rounded-xl bg-wash px-4 py-3 text-sm" role="status">
          {n ? <><b>{plural(sheets, 'folha', 'folhas')}</b> para imprimir{spare > 0 && <span className="text-ink-2"> · a última fica com {plural(PER_SHEET - spare, 'cartão', 'cartões')}</span>}</> : 'Indique um número de 1 a ' + MAX_CARDS + '.'}
        </p>
        <Button className="w-full" disabled={!n || busy}>
          {busy ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" />A preparar as folhas…</> : <><FileDown size={18} aria-hidden="true" />Descarregar PDF</>}
        </Button>
      </form>
    </Modal>
  )
}
