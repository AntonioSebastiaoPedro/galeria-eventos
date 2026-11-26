import { useRef, useState } from 'react'
import { AlertCircle, Camera, Check, ImagePlus, Loader2, RotateCcw, Video, X } from 'lucide-react'
import { Button, Modal } from '../../components'
import type { UploadItem } from '../../uploader'
import type { UploadRules } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  rules: UploadRules
  moderated: boolean
  askName: boolean
  initialName: string
  uploader: { items: UploadItem[]; add: (files: File[], fields: Record<string, string>) => void; retry: (id: number, fields: Record<string, string>) => void; cancel: (id: number) => void; clearFinished: () => void; busy: boolean }
}

const NAME_KEY = 'galeria.name'

// Partilhar: escolher na galeria do telemóvel ou tirar uma fotografia, com o nome (ou pseudónimo) de quem partilha.
export default function UploadPanel({ open, onClose, rules, moderated, askName, initialName, uploader }: Props) {
  const [name, setName] = useState(() => initialName || localStorage.getItem(NAME_KEY) || '')
  const [caption, setCaption] = useState('')
  const [nameError, setNameError] = useState(false)
  const pick = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const fields = { name: name.trim(), caption: caption.trim() }

  const choose = (input: HTMLInputElement | null) => {
    if (askName && !name.trim()) { setNameError(true); document.getElementById('guest-name')?.focus(); return }
    input?.click()
  }
  const onFiles = (list: FileList | null) => {
    if (!list?.length) return
    try { localStorage.setItem(NAME_KEY, name.trim()) } catch { /* sem armazenamento */ }
    uploader.add([...list], fields)
  }
  const accept = [...rules.photo_types, 'image/heic', 'image/heif', ...(rules.videos ? rules.video_types : [])].join(',')
  const done = uploader.items.filter((i) => i.status === 'done').length

  return (
    <Modal open={open} onClose={onClose} title="Partilhar fotografias" wide>
      {askName && (
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-semibold">O seu nome</span>
          <input id="guest-name" value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setNameError(false) }} placeholder="Ex.: Tia Rosa" autoComplete="name" aria-invalid={nameError}
            className="h-12 w-full rounded-xl border border-line bg-paper px-4 text-base focus:border-ink focus:outline-none aria-[invalid=true]:border-danger" />
          <span className={`mt-1 block text-xs ${nameError ? 'text-danger' : 'text-ink-3'}`}>{nameError ? 'Escreva o seu nome ou um pseudónimo para continuar.' : 'Aparece junto do que partilhar. Pode ser um pseudónimo.'}</span>
        </label>
      )}
      <label className="mb-5 block">
        <span className="mb-1.5 block text-sm font-semibold">Legenda <span className="font-normal text-ink-3">(opcional)</span></span>
        <input value={caption} maxLength={rules.caption_max} onChange={(e) => setCaption(e.target.value)} placeholder="Ex.: A entrada dos noivos!"
          className="h-12 w-full rounded-xl border border-line bg-paper px-4 text-base focus:border-ink focus:outline-none" />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => choose(pick.current)} className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-2xl bg-coral font-semibold text-white transition hover:brightness-110 active:scale-[0.98]">
          <ImagePlus size={26} aria-hidden="true" />Escolher {rules.videos ? 'fotografias e vídeos' : 'fotografias'}
        </button>
        <button type="button" onClick={() => choose(camera.current)} className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-paper font-semibold transition hover:bg-wash active:scale-[0.98]">
          <Camera size={26} aria-hidden="true" />Tirar fotografia
        </button>
      </div>
      <input ref={pick} type="file" multiple accept={accept} className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} />

      <p className="mt-3 text-xs text-ink-3">
        Fotografias até {rules.photo_max_mb} MB{rules.videos ? ` · vídeos até ${rules.video_max_mb} MB` : ' · esta galeria não aceita vídeos'}.
        {moderated && ' O organizador aprova o que é partilhado antes de aparecer a todos.'}
      </p>

      {uploader.items.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold">{done} de {uploader.items.length} enviados</span>
            {!uploader.busy && <button className="font-semibold text-ink-2 underline underline-offset-4" onClick={uploader.clearFinished}>Limpar lista</button>}
          </div>
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {uploader.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-xl bg-wash p-2">
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-line text-ink-2">
                  {i.preview ? <img src={i.preview} alt="" className="size-full object-cover" /> : i.kind === 'video' ? <Video size={20} aria-hidden="true" /> : <ImagePlus size={20} aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.name}</p>
                  {i.status === 'error' ? <p className="text-xs text-danger">{i.error}</p> : (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(i.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Envio de ${i.name}`}>
                      <div className={`h-full rounded-full transition-[width] ${i.status === 'done' ? 'bg-leaf' : 'bg-coral'}`} style={{ width: `${Math.max(i.status === 'waiting' ? 0 : 4, i.progress * 100)}%` }} />
                    </div>
                  )}
                </div>
                <span className="flex size-9 shrink-0 items-center justify-center">
                  {i.status === 'done' && <Check size={20} className="text-leaf" aria-label="Enviado" />}
                  {(i.status === 'uploading' || i.status === 'preparing') && <Loader2 size={18} className="animate-spin text-ink-3" aria-label="A enviar" />}
                  {i.status === 'error' && i.retryable && (
                    <button onClick={() => uploader.retry(i.id, fields)} aria-label="Tentar outra vez" className="flex size-9 items-center justify-center rounded-full hover:bg-line"><RotateCcw size={16} /></button>
                  )}
                  {i.status === 'error' && !i.retryable && <AlertCircle size={18} className="text-danger" aria-hidden="true" />}
                  {i.status === 'waiting' && <button onClick={() => uploader.cancel(i.id)} aria-label="Cancelar" className="flex size-9 items-center justify-center rounded-full hover:bg-line"><X size={16} /></button>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button variant="primary" className="mt-6 w-full" onClick={onClose}>{uploader.busy ? 'Continuar a ver a galeria (o envio continua)' : 'Concluído'}</Button>
    </Modal>
  )
}
