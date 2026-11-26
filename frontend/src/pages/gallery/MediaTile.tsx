import { Clock, Loader2, Play } from 'lucide-react'
import { fmtDuration } from '../../format'
import type { GalleryMedia } from '../../types'

// Uma fotografia ou vídeo na grelha. A proporção vem do servidor, para a grelha não saltar ao carregar.
export function MediaTile({ m, onOpen, dark = true }: { m: GalleryMedia; onOpen: () => void; dark?: boolean }) {
  const ratio = m.width && m.height ? `${m.width} / ${m.height}` : '4 / 3'
  const label = m.type === 'video' ? `Vídeo${m.author ? ` de ${m.author}` : ''}` : `Fotografia${m.author ? ` de ${m.author}` : ''}`
  return (
    <button type="button" onClick={onOpen} aria-label={label}
      className={`group relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-xl md:mb-3 ${dark ? 'bg-night-2' : 'bg-wash'}`} style={{ aspectRatio: ratio }}>
      {m.thumb_url ? (
        <img src={m.thumb_url} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      ) : (
        <span className="flex size-full items-center justify-center text-cream/40">{m.status === 'processing' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}</span>
      )}
      {m.type === 'video' && (
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
          <Play size={12} fill="currentColor" aria-hidden="true" />{fmtDuration(m.duration) || 'Vídeo'}
        </span>
      )}
      {m.status !== 'approved' && (
        <span className="absolute inset-x-2 top-2 inline-flex items-center justify-center gap-1 rounded-full bg-gold px-2 py-1 text-xs font-bold text-gold-ink">
          {m.status === 'processing' ? <><Loader2 size={12} className="animate-spin" aria-hidden="true" />A preparar…</> : <><Clock size={12} aria-hidden="true" />À espera de aprovação</>}
        </span>
      )}
    </button>
  )
}
