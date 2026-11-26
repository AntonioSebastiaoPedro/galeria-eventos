import { useCallback, useRef, useState } from 'react'
import { ApiError, upload } from './api'
import { isImage, isVideo, preparePhoto } from './image'
import type { UploadRules } from './types'
import { errorMessage } from './toast'

export interface UploadItem {
  id: number
  name: string
  kind: 'photo' | 'video'
  preview: string | null
  status: 'waiting' | 'preparing' | 'uploading' | 'done' | 'error'
  progress: number
  error?: string
  retryable?: boolean // falhas de rede ou do servidor; os ficheiros recusados pelas regras não
  file: File
}

let nextId = 1

// Fila de envios: um pedido por ficheiro, dois de cada vez, cada um com a sua barra de progresso.
// Os ficheiros que não cumprem as regras são recusados logo no telemóvel, sem gastar dados.
export function useUploader(path: string, rules: UploadRules | undefined, onUploaded: () => void) {
  const [items, setItems] = useState<UploadItem[]>([])
  const running = useRef(0)
  const queue = useRef<{ item: UploadItem; fields: Record<string, string> }[]>([])
  const controllers = useRef(new Map<number, AbortController>())

  const patch = useCallback((id: number, p: Partial<UploadItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i))), [])

  const pump = useCallback(() => {
    const run = () => {
      while (running.current < 2 && queue.current.length) {
        const { item, fields } = queue.current.shift()!
        running.current++
        const ctrl = new AbortController()
        controllers.current.set(item.id, ctrl)
        void (async () => {
          try {
            let file = item.file
            if (item.kind === 'photo' && rules) {
              patch(item.id, { status: 'preparing' })
              file = await preparePhoto(file, rules.photo_max_mb * 1024 * 1024)
            }
            patch(item.id, { status: 'uploading', progress: 0 })
            const form = new FormData()
            form.append('file', file, file.name)
            Object.entries(fields).forEach(([k, v]) => v && form.append(k, v))
            await upload(path, form, (p) => patch(item.id, { progress: p }), ctrl.signal)
            patch(item.id, { status: 'done', progress: 1 })
            onUploaded()
          } catch (e) {
            if (!(e instanceof ApiError && e.status === -1)) patch(item.id, { status: 'error', error: errorMessage(e), retryable: !(e instanceof ApiError && [403, 413, 422].includes(e.status)) })
          } finally {
            controllers.current.delete(item.id)
            running.current--
            run()
          }
        })()
      }
    }
    run()
  }, [path, rules, patch, onUploaded])

  const add = useCallback((files: File[], fields: Record<string, string>) => {
    const fresh: UploadItem[] = files.map((file) => {
      const kind = isVideo(file) ? 'video' : 'photo'
      const item: UploadItem = { id: nextId++, name: file.name, kind, file, status: 'waiting', progress: 0, preview: isImage(file) && !/heic|heif/i.test(file.type) ? URL.createObjectURL(file) : null }
      if (!isVideo(file) && !isImage(file)) return { ...item, status: 'error', error: 'Só fotografias e vídeos.' }
      if (kind === 'video' && rules && !rules.videos) return { ...item, status: 'error', error: 'Esta galeria não aceita vídeos.' }
      if (kind === 'video' && rules && file.size > rules.video_max_mb * 1024 * 1024) return { ...item, status: 'error', error: `O vídeo tem mais de ${rules.video_max_mb} MB.` }
      return item
    })
    setItems((list) => [...list, ...fresh])
    fresh.filter((i) => i.status === 'waiting').forEach((item) => queue.current.push({ item, fields }))
    pump()
  }, [rules, pump])

  const retry = useCallback((id: number, fields: Record<string, string>) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    patch(id, { status: 'waiting', error: undefined, progress: 0 })
    queue.current.push({ item, fields })
    pump()
  }, [items, patch, pump])

  const cancel = useCallback((id: number) => {
    controllers.current.get(id)?.abort()
    queue.current = queue.current.filter((q) => q.item.id !== id)
    setItems((list) => list.filter((i) => i.id !== id))
  }, [])

  const clearFinished = useCallback(() => {
    setItems((list) => {
      list.filter((i) => i.status === 'done' || i.status === 'error').forEach((i) => i.preview && URL.revokeObjectURL(i.preview))
      return list.filter((i) => i.status !== 'done' && i.status !== 'error')
    })
  }, [])

  const busy = items.some((i) => i.status === 'waiting' || i.status === 'preparing' || i.status === 'uploading')
  return { items, add, retry, cancel, clearFinished, busy }
}
