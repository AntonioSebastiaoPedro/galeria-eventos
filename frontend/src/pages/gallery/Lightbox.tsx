import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Download, Share2, Trash2, X } from 'lucide-react'
import { fmtRelative } from '../../format'
import { toast } from '../../toast'
import type { GalleryMedia } from '../../types'

interface Props {
  items: GalleryMedia[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  onNeedMore?: () => void
  onDelete?: (m: GalleryMedia) => void
  shareUrl: string
  title: string
}

// Visualização em ecrã inteiro: setas, teclado e deslizar o dedo. Os vídeos tocam aqui.
export default function Lightbox({ items, index, onIndex, onClose, onNeedMore, onDelete, shareUrl, title }: Props) {
  const m = items[index]
  const touch = useRef<number | null>(null)
  const [loaded, setLoaded] = useState<string | null>(null)
  const prev = () => index > 0 && onIndex(index - 1)
  const next = () => index < items.length - 1 && onIndex(index + 1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = overflow }
  })

  // Perto do fim da lista carregada, pede mais à galeria.
  useEffect(() => { if (index >= items.length - 3) onNeedMore?.() }, [index, items.length, onNeedMore])

  if (!m) return null

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, url: shareUrl })
      else { await navigator.clipboard.writeText(shareUrl); toast('Link da galeria copiado.') }
    } catch { /* partilha cancelada */ }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex animate-fade flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Visualizador"
      onTouchStart={(e) => { touch.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touch.current === null) return
        const dx = e.changedTouches[0].clientX - touch.current
        if (Math.abs(dx) > 60) (dx > 0 ? prev : next)()
        touch.current = null
      }}>
      <div className="flex h-14 shrink-0 items-center justify-between px-2 pt-[env(safe-area-inset-top)]">
        <span className="px-3 text-sm tabular-nums text-white/60">{index + 1} / {items.length}</span>
        <button onClick={onClose} aria-label="Fechar" className="flex size-11 items-center justify-center rounded-full hover:bg-white/10"><X size={24} /></button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {m.type === 'video' && m.stream_url ? (
          <video key={m.id} src={m.stream_url} poster={m.preview_url ?? undefined} controls playsInline autoPlay className="max-h-full max-w-full" />
        ) : (
          <>
            {m.thumb_url && loaded !== m.preview_url && <img src={m.thumb_url} alt="" className="absolute max-h-full max-w-full object-contain blur-sm" aria-hidden="true" />}
            {m.preview_url && <img key={m.id} src={m.preview_url} alt={m.caption ?? 'Fotografia'} onLoad={() => setLoaded(m.preview_url)} className="relative max-h-full max-w-full object-contain" />}
          </>
        )}
        {index > 0 && <button onClick={prev} aria-label="Anterior" className="absolute left-2 hidden size-12 items-center justify-center rounded-full bg-black/40 hover:bg-white/15 md:flex"><ChevronLeft size={28} /></button>}
        {index < items.length - 1 && <button onClick={next} aria-label="Seguinte" className="absolute right-2 hidden size-12 items-center justify-center rounded-full bg-black/40 hover:bg-white/15 md:flex"><ChevronRight size={28} /></button>}
      </div>

      <div className="shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:px-8">
        <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {m.caption && <p className="mb-1 text-lg">{m.caption}</p>}
            <p className="text-sm text-white/60">{m.author ? `Partilhado por ${m.author}` : 'Partilhado'} · {fmtRelative(m.created_at)}</p>
          </div>
          <div className="flex gap-2">
            {m.download_url && <a href={m.download_url} download className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/10 px-4 font-semibold hover:bg-white/20"><Download size={18} aria-hidden="true" />Descarregar</a>}
            <button onClick={share} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/10 px-4 font-semibold hover:bg-white/20"><Share2 size={18} aria-hidden="true" /><span className="hidden sm:inline">Partilhar</span></button>
            {m.can_delete && onDelete && (
              <button onClick={() => onDelete(m)} aria-label="Apagar" className="inline-flex size-11 items-center justify-center rounded-xl bg-white/10 text-coral hover:bg-white/20"><Trash2 size={18} /></button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
