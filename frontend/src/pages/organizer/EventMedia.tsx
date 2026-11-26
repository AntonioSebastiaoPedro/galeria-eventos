import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCheck, ImagePlus, Images, Trash2 } from 'lucide-react'
import { api } from '../../api'
import { Button, buttonClass, EmptyState, Segmented, Spinner } from '../../components'
import { fmtRelative, fmtSize, plural } from '../../format'
import { usePaged } from '../../pagination'
import { toast } from '../../toast'
import type { ManagedMedia } from '../../types'
import Lightbox from '../gallery/Lightbox'
import { MediaTile } from '../gallery/MediaTile'
import { useEvent } from './useEvent'

type Status = 'all' | 'pending' | 'approved' | 'processing'
type Kind = 'all' | 'photo' | 'video'

// Moderação: ver tudo o que chegou, aprovar (na moderação manual) e apagar o que não deve estar na galeria.
export default function EventMediaPage() {
  const e = useEvent()
  const qc = useQueryClient()
  const [status, setStatus] = useState<Status>(e.counts.pending > 0 ? 'pending' : 'all')
  const [kind, setKind] = useState<Kind>('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [open, setOpen] = useState<number | null>(null)
  const path = `/events/${e.id}/media`
  const { rows, total, isLoading, footer } = usePaged<ManagedMedia>(path, { ...(status !== 'all' ? { status } : {}), ...(kind !== 'all' ? { type: kind } : {}) })

  const refresh = () => {
    setSelected(new Set())
    void qc.invalidateQueries({ queryKey: [path] })
    void qc.invalidateQueries({ queryKey: ['event', String(e.id)] })
    void qc.invalidateQueries({ queryKey: ['event-stats', String(e.id)] })
  }
  const approve = useMutation({ mutationFn: (m: ManagedMedia) => api(`/media/${m.id}/approve`, 'POST'), onSuccess: () => { toast('Publicado na galeria.'); refresh() } })
  const remove = useMutation({ mutationFn: (m: ManagedMedia) => api(`/media/${m.id}`, 'DELETE'), onSuccess: () => { setOpen(null); toast('Apagado.'); refresh() } })
  const bulk = useMutation({
    mutationFn: (action: 'approve' | 'delete') => api<{ affected: number }>(`/events/${e.id}/media/bulk`, 'POST', { action, ids: [...selected] }),
    onSuccess: (r, action) => { toast(action === 'delete' ? `${plural(r.affected, 'conteúdo apagado', 'conteúdos apagados')}.` : 'Publicados na galeria.'); refresh() },
  })

  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const pendingSelected = rows.filter((m) => selected.has(m.id) && m.status === 'pending').length

  return (
    <>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Segmented full value={status} onChange={(v) => { setStatus(v); setSelected(new Set()) }} options={[
            { value: 'all', label: 'Tudo' },
            { value: 'pending', label: 'Por aprovar', count: e.counts.pending },
            { value: 'approved', label: 'Publicados' },
            // "A preparar" só interessa enquanto há envios a ser processados.
            ...(e.counts.processing > 0 || status === 'processing' ? [{ value: 'processing' as const, label: 'A preparar', count: e.counts.processing || undefined }] : []),
          ]} />
          <Segmented full value={kind} onChange={setKind} options={[{ value: 'all', label: 'Todos' }, { value: 'photo', label: 'Fotografias' }, { value: 'video', label: 'Vídeos' }]} />
        </div>
        <a href={`/g/${e.slug}`} target="_blank" rel="noreferrer" className={buttonClass('soft', 'w-full sm:w-auto')}><ImagePlus size={18} aria-hidden="true" />Enviar na galeria</a>
      </div>

      {e.moderation === 'auto' && status === 'pending' && <p className="mb-4 text-sm text-ink-2">A moderação está em automático: o que os convidados enviam é publicado logo. Pode mudar em Definições.</p>}

      {isLoading ? <Spinner /> : !rows.length ? (
        <EmptyState icon={<Images size={26} />} title={status === 'pending' ? 'Nada por aprovar' : 'Ainda não há conteúdos'} hint={status === 'all' ? 'Partilhe o link ou o QR Code com os convidados.' : undefined} />
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-3">{plural(total ?? 0, 'conteúdo', 'conteúdos')} · seleccione para aprovar ou apagar vários de uma vez.</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((m, i) => (
              <li key={m.id} className={`relative rounded-2xl border bg-paper p-2 ${selected.has(m.id) ? 'border-coral ring-2 ring-coral/40' : 'border-line'}`}>
                <div className="aspect-square overflow-hidden rounded-xl [&>button]:mb-0 [&>button]:h-full"><MediaTile m={m} onOpen={() => setOpen(i)} dark={false} /></div>
                <label className="absolute left-3 top-3 flex size-9 cursor-pointer items-center justify-center rounded-lg bg-paper/90 shadow">
                  <input type="checkbox" className="size-5 accent-coral" checked={selected.has(m.id)} onChange={() => toggle(m.id)} aria-label={`Seleccionar ${m.original_name}`} />
                </label>
                <div className="px-1 pt-2">
                  <p className="truncate text-sm font-semibold">{m.author ?? 'Sem nome'}{m.by_organizer && <span className="ml-1 text-xs font-normal text-ink-3">(organizador)</span>}</p>
                  <p className="truncate text-xs text-ink-3">{fmtRelative(m.created_at)} · {fmtSize(m.file_size)}</p>
                  {m.caption && <p className="mt-1 line-clamp-2 text-xs text-ink-2">“{m.caption}”</p>}
                  <div className="mt-2 flex gap-1.5">
                    {m.status === 'pending' && <Button className="h-10! flex-1 px-2! text-sm" variant="primary" onClick={() => approve.mutate(m)}><Check size={16} aria-hidden="true" />Aprovar</Button>}
                    <Button className="h-10! px-3! text-sm" variant="soft" aria-label="Apagar" onClick={() => { if (confirm('Apagar da galeria? O ficheiro é eliminado e não se pode recuperar.')) remove.mutate(m) }}><Trash2 size={16} /></Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {footer}
        </>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center justify-between gap-2 rounded-2xl bg-ink p-2 pl-4 text-white shadow-2xl md:bottom-6">
          <span className="min-w-0 truncate text-sm font-semibold">{selected.size} seleccionado(s)</span>
          <div className="flex shrink-0 gap-2">
            {pendingSelected > 0 && <Button variant="light" className="px-3.5!" disabled={bulk.isPending} onClick={() => bulk.mutate('approve')}><CheckCheck size={18} aria-hidden="true" />Aprovar</Button>}
            <Button variant="coral" className="px-3.5!" disabled={bulk.isPending} onClick={() => { if (confirm(`Apagar ${selected.size} conteúdo(s)? Não se pode desfazer.`)) bulk.mutate('delete') }}><Trash2 size={18} aria-hidden="true" />Apagar</Button>
          </div>
        </div>
      )}

      {open !== null && (
        <Lightbox items={rows} index={open} onIndex={setOpen} onClose={() => setOpen(null)} shareUrl={`${location.origin}/g/${e.slug}`} title={e.title}
          onDelete={(m) => { if (confirm('Apagar da galeria? Não se pode desfazer.')) remove.mutate(m as ManagedMedia) }} />
      )}
    </>
  )
}
