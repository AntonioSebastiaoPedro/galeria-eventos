import { useEffect, useState } from 'react'
import { Copy, Download, Loader2, MoreHorizontal } from 'lucide-react'
import { Button, Modal } from './components'
import { plural } from './format'
import { fetchFiles, supportsFileShare } from './shareFiles'
import { toast } from './toast'
import type { GalleryMedia } from './types'

/*
 * Partilhar nas redes (WhatsApp, Instagram, Facebook) e guardar vários ficheiros de uma vez.
 *
 * O que o navegador permite:
 * - Um link: WhatsApp (wa.me) e Facebook (sharer) abrem directamente com o link. O Instagram não aceita links
 *   vindos de sites: o link é copiado e o Instagram abre nas mensagens, para o colar.
 * - Fotografias e vídeos: nenhuma rede aceita ficheiros por um endereço. No telemóvel usa-se a partilha do
 *   sistema com os próprios ficheiros (a lista de aplicações abre e a pessoa escolhe a rede). No computador,
 *   sem essa partilha, WhatsApp e Facebook recebem o link da galeria.
 */

export type ShareSubject =
  | { kind: 'link'; url: string; title: string; text: string; warning?: string }
  | { kind: 'media'; items: GalleryMedia[]; url: string; title: string }

type Network = 'whatsapp' | 'instagram' | 'facebook'





const openExternal = (url: string) => { window.open(url, '_blank', 'noopener') }
const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`
const facebookUrl = (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`


type Prepared = { status: 'idle' | 'loading' | 'ready' | 'error'; done: number; files: File[]; error?: string }

// Prepara os ficheiros logo que o painel abre: quando a pessoa toca na rede, a partilha abre de imediato
// (o navegador só deixa abrir a partilha logo a seguir ao toque, não depois de uma espera).
function usePreparedFiles(items: GalleryMedia[] | null): Prepared {
  const [state, setState] = useState<Prepared & { for: GalleryMedia[] | null }>({ for: null, status: 'idle', done: 0, files: [] })
  useEffect(() => {
    if (!items?.length) return
    const ctrl = new AbortController()
    fetchFiles(items, (done) => setState({ for: items, status: 'loading', done, files: [] }), ctrl.signal)
      .then((files) => setState({ for: items, status: 'ready', done: files.length, files }))
      .catch((e: Error) => { if (!ctrl.signal.aborted) setState({ for: items, status: 'error', done: 0, files: [], error: e.message }) })
    return () => ctrl.abort()
  }, [items])
  // Enquanto o estado não é desta lista, ainda está a preparar.
  if (state.for === items) return state
  return { status: items?.length ? 'loading' : 'idle', done: 0, files: [] }
}

async function shareFiles(files: File[], title: string) {
  try { await navigator.share({ files, title }) } catch (e) {
    if ((e as Error).name !== 'AbortError') toast('Não foi possível abrir a partilha. Tente com menos ficheiros.', 'error')
  }
}

const describe = (items: GalleryMedia[]) => {
  const videos = items.filter((m) => m.type === 'video').length
  const photos = items.length - videos
  return [photos && plural(photos, 'fotografia', 'fotografias'), videos && plural(videos, 'vídeo', 'vídeos')].filter(Boolean).join(' e ')
}

/* ───────── Ícones das redes (desenhos simples, nas cores de cada uma) ───────── */

const NETWORKS: { key: Network; label: string; bg: string; icon: React.ReactNode }[] = [
  {
    key: 'whatsapp', label: 'WhatsApp', bg: 'bg-[#25d366]',
    icon: (
      <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
        <path fill="none" stroke="white" strokeWidth="1.8" strokeLinejoin="round" d="M4.2 19.8l1.1-3.9A8.2 8.2 0 1 1 8.4 19z" />
        <path fill="white" d="M9.1 7.6c.2-.4.4-.4.6-.4h.5c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.4.7 1 1.4 1.7 1.9.4.3.9.5 1.2.7.2.1.4 0 .5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.3.2.3.4 0 .3-.1 1-.5 1.4-.4.4-1.1.7-1.8.6-1-.1-2.4-.7-3.6-1.7-1.3-1.1-2.2-2.5-2.5-3.5-.3-1 .1-1.8.3-2z" />
      </svg>
    ),
  },
  {
    key: 'instagram', label: 'Instagram', bg: 'bg-[linear-gradient(45deg,#f9a825,#e1306c_50%,#833ab4)]',
    icon: (
      <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="0.6" fill="white" />
      </svg>
    ),
  },
  {
    key: 'facebook', label: 'Facebook', bg: 'bg-[#1877f2]',
    icon: (
      <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
        <path fill="white" d="M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21z" />
      </svg>
    ),
  },
]

/* ───────── Painel de partilha ───────── */

export function ShareSheet({ subject, onClose }: { subject: ShareSubject | null; onClose: () => void }) {
  const media = subject?.kind === 'media' ? subject.items : null
  const fileShare = !!media && supportsFileShare()
  // subject vem do estado de quem abre o painel: a lista é a mesma entre renderizações e só é preparada uma vez.
  const prepared = usePreparedFiles(fileShare ? media : null)

  if (!subject) return null
  const waiting = fileShare && prepared.status !== 'ready'

  const go = (network: Network) => {
    // Fotografias e vídeos no telemóvel: a partilha do sistema com os ficheiros.
    if (fileShare) {
      if (prepared.status === 'ready') void shareFiles(prepared.files, subject.title)
      return
    }
    const text = subject.kind === 'link' ? `${subject.text} ${subject.url}` : `Veja as fotografias e os vídeos de ${subject.title}: ${subject.url}`
    if (network === 'whatsapp') openExternal(whatsappUrl(text))
    if (network === 'facebook') openExternal(facebookUrl(subject.url))
    if (network === 'instagram') {
      if (subject.kind === 'media') {
        toast('No computador, o Instagram não deixa publicar a partir do navegador. Descarregue e publique na aplicação.', 'info')
        return
      }
      void navigator.clipboard?.writeText(subject.url)
      openExternal('https://www.instagram.com/direct/inbox/')
      toast('Link copiado. No Instagram, cole-o numa mensagem ou na sua story.', 'info')
    }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(subject.url); toast('Link copiado.') } catch { toast(subject.url, 'info') }
  }
  const more = async () => {
    try {
      if (fileShare && prepared.status === 'ready') await navigator.share({ files: prepared.files, title: subject.title })
      else await navigator.share({ title: subject.title, text: subject.kind === 'link' ? subject.text : undefined, url: subject.url })
    } catch { /* cancelado */ }
  }

  return (
    <Modal open onClose={onClose} title="Partilhar">
      {media && <p className="-mt-3 mb-4 text-sm text-ink-2">{describe(media)}</p>}
      {subject.kind === 'link' && subject.warning && <p className="-mt-2 mb-4 rounded-xl bg-gold/25 px-3 py-2 text-sm text-gold-ink">{subject.warning}</p>}

      <div className="grid grid-cols-3 gap-2">
        {NETWORKS.map((n) => (
          <button key={n.key} type="button" onClick={() => go(n.key)} disabled={waiting}
            className="flex flex-col items-center gap-2 rounded-2xl py-3 transition active:scale-95 disabled:opacity-40">
            <span className={`flex size-14 items-center justify-center rounded-full ${n.bg}`}>{n.icon}</span>
            <span className="text-sm font-semibold">{n.label}</span>
          </button>
        ))}
      </div>

      {fileShare && (
        <p className="mt-3 text-center text-sm text-ink-2" role="status">
          {prepared.status === 'loading' && <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" aria-hidden="true" />A preparar {Math.min(prepared.done + 1, media!.length)} de {media!.length}…</span>}
          {prepared.status === 'ready' && 'Ao tocar numa rede, o telemóvel mostra as aplicações: escolha a mesma rede na lista.'}
          {prepared.status === 'error' && <span className="text-danger">{prepared.error}</span>}
        </p>
      )}

      <div className="mt-5 flex gap-2 border-t border-line pt-4">
        <Button variant="soft" className="flex-1" onClick={copy}><Copy size={18} aria-hidden="true" />Copiar link</Button>
        {typeof navigator.share === 'function' && <Button variant="soft" className="flex-1" disabled={waiting} onClick={more}><MoreHorizontal size={18} aria-hidden="true" />Outras apps</Button>}
      </div>
    </Modal>
  )
}

/* ───────── Guardar vários de uma vez ───────── */



// iPhone: os descarregamentos vão para a app Ficheiros, não para as Fotos. Pela partilha do sistema,
// "Guardar imagens" põe-nas directamente na galeria do telemóvel.
export function SaveSheet({ items, onClose }: { items: GalleryMedia[] | null; onClose: () => void }) {
  const prepared = usePreparedFiles(items)
  if (!items) return null
  return (
    <Modal open onClose={onClose} title="Guardar no telemóvel">
      <p className="-mt-3 mb-5 text-sm text-ink-2">{describe(items)}</p>
      {prepared.status === 'error' ? <p className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{prepared.error}</p> : (
        <p className="mb-4 text-sm text-ink-2" role="status">
          {prepared.status === 'ready' ? <>Toque em <b>Guardar</b> e, na lista, escolha <b>Guardar {items.length > 1 ? `${items.length} itens` : 'imagem'}</b>: ficam nas Fotos.</> : `A preparar ${Math.min(prepared.done + 1, items.length)} de ${items.length}…`}
        </p>
      )}
      <Button className="w-full" variant="coral" disabled={prepared.status !== 'ready'} onClick={() => void shareFiles(prepared.files, 'Fotografias')}>
        {prepared.status === 'ready' ? <><Download size={18} aria-hidden="true" />Guardar</> : <><Loader2 size={18} className="animate-spin" aria-hidden="true" />A preparar…</>}
      </Button>
    </Modal>
  )
}
