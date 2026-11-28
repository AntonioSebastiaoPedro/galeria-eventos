import { plural } from './format'
import { toast } from './toast'
import type { GalleryMedia } from './types'

// Ficheiros para partilhar ou guardar vários de uma vez (usado por share.tsx e pela galeria).

// O WhatsApp aceita até 30 ficheiros de cada vez: é também o limite da selecção.
export const MAX_BATCH = 30
const MAX_SHARE_BYTES = 200 * 1024 * 1024

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp' }

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// O dispositivo partilha ficheiros pela partilha do sistema? (telemóveis sim; a maior parte dos computadores não)
export const supportsFileShare = () => {
  try { return !!navigator.canShare?.({ files: [new File([''], 'a.jpg', { type: 'image/jpeg' })] }) } catch { return false }
}

// Descarrega os ficheiros para os partilhar (a partilha do sistema precisa dos ficheiros, não de links).
export async function fetchFiles(items: GalleryMedia[], onProgress: (done: number) => void, signal: AbortSignal): Promise<File[]> {
  const files: File[] = []
  let bytes = 0
  for (const m of items) {
    if (!m.download_url) continue
    const res = await fetch(m.download_url, { credentials: 'include', signal })
    if (!res.ok) throw new Error('Não foi possível obter um dos ficheiros. Tente outra vez.')
    bytes += Number(res.headers.get('Content-Length') || 0)
    if (bytes > MAX_SHARE_BYTES) throw new Error('São ficheiros demasiado grandes para enviar de uma vez. Escolha menos vídeos.')
    const blob = await res.blob()
    const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `galeria-${m.id}.${EXT[blob.type] ?? 'jpg'}`
    files.push(new File([blob], name, { type: blob.type }))
    onProgress(files.length)
  }
  return files
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Android e computador: um descarregamento por ficheiro (o navegador pode pedir autorização para vários).
export async function downloadEach(items: GalleryMedia[]) {
  const urls = items.map((m) => m.download_url).filter((u): u is string => !!u)
  toast(`A descarregar ${plural(urls.length, 'ficheiro', 'ficheiros')}… Se o navegador perguntar, permita várias transferências.`, 'info')
  for (const url of urls) {
    const a = document.createElement('a')
    a.href = url
    a.download = ''
    document.body.append(a)
    a.click()
    a.remove()
    await sleep(700)
  }
}
