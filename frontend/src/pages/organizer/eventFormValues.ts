import type { ManagedEvent } from '../../types'

export interface EventFormValues {
  title: string
  event_type: string
  event_date: string
  description: string
  visibility: 'public' | 'private'
  access_code: string
  remove_access_code: boolean
  upload_enabled: boolean
  allow_videos: boolean
  moderation: 'auto' | 'manual'
}

export const toForm = (e?: ManagedEvent): EventFormValues => ({
  title: e?.title ?? '',
  event_type: e?.event_type ?? 'birthday',
  event_date: e?.event_date ?? new Date().toISOString().slice(0, 10),
  description: e?.description ?? '',
  visibility: e?.visibility ?? 'private',
  access_code: '',
  remove_access_code: false,
  upload_enabled: e?.upload_enabled ?? true,
  allow_videos: e?.allow_videos ?? true,
  moderation: e?.moderation ?? 'auto',
})

// Só envia o código quando foi escrito (um código vazio não apaga o actual).
export const formPayload = (v: EventFormValues) => {
  const { access_code, remove_access_code, ...rest } = v
  return { ...rest, ...(access_code.trim() ? { access_code: access_code.trim() } : {}), ...(remove_access_code ? { remove_access_code: true } : {}) }
}
