export interface Plan { key: string; name: string; price_kz: number; storage_mb: number; max_photos: number | null; videos: boolean; zip: boolean }

export interface Counts { photos: number; videos: number; pending: number; processing: number; storage_used: number; storage_limit: number }

export interface ManagedEvent {
  id: number
  title: string
  slug: string
  description: string | null
  event_type: string
  event_date: string
  visibility: 'public' | 'private'
  has_access_code: boolean
  upload_enabled: boolean
  allow_videos: boolean
  moderation: 'auto' | 'manual'
  status: 'active' | 'disabled'
  plan: Plan
  cover_url: string | null
  guest_url: string
  owner: { id: number; name: string; email: string | null; phone: string | null } | null
  counts: Counts
  created_at: string
}

export type MediaStatus = 'processing' | 'pending' | 'approved' | 'failed'

export interface GalleryMedia {
  id: number
  type: 'photo' | 'video'
  status: MediaStatus
  width: number | null
  height: number | null
  duration: number | null
  caption: string | null
  author: string | null
  created_at: string
  mine: boolean
  can_delete: boolean
  thumb_url: string | null
  preview_url: string | null
  stream_url: string | null
  download_url: string | null
}

export interface ManagedMedia extends GalleryMedia {
  guest_id: number | null
  by_organizer: boolean
  original_name: string
  file_size: number
  original_url: string | null
}

export interface UploadRules { photo_max_mb: number; video_max_mb: number; videos: boolean; photo_types: string[]; video_types: string[]; caption_max: number }

export interface GalleryEvent {
  slug: string
  title: string
  event_type: string
  event_date: string
  visibility: 'public' | 'private'
  has_access_code: boolean
  access: 'granted' | 'needs_access' | 'blocked' | 'disabled'
  is_manager: boolean
  manage_id: number | null
  guest: { name: string | null } | null
  description?: string | null
  cover_url?: string | null
  upload_enabled?: boolean
  moderation?: 'auto' | 'manual'
  photos?: number
  videos?: number
  storage_full?: boolean
  rules?: UploadRules
}

export interface Guest { id: number; name: string | null; blocked: boolean; photos: number; videos: number; last_seen_at: string | null; created_at: string }

export interface Export { id: number; status: 'queued' | 'processing' | 'ready' | 'failed'; file_size: number | null; items: number | null; error: string | null; created_at: string; expires_at: string }

export interface PlanRequest {
  id: number
  event_id: number
  from_plan: string
  to_plan: string
  from_plan_name: string
  to_plan_name: string
  amount_kz: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  admin_note: string | null
  proof_name: string | null
  proof_mime: string | null
  proof_url: string | null
  created_at: string
  reviewed_at: string | null
}

export interface AppSettings {
  payment: { method: string; number: string; holder: string | null } | null
  support_phone: string | null
  proof_max_mb: number
}

export interface PlanRequestInfo extends AppSettings {
  current: PlanRequest | null
  upgrades: (Plan & { amount_kz: number })[]
}

export interface Paged<T> { data: T[]; current_page: number; last_page: number; per_page: number; total: number }
