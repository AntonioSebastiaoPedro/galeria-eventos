import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDownUp, ArrowLeft, CircleCheck, Download, ImagePlus, Images, Loader2, Share2, X } from 'lucide-react'
import { api } from '../../api'
import { Brand, Segmented, Spinner } from '../../components'
import { EVENT_TYPES, fmtLongDate, plural } from '../../format'
import { SaveSheet, ShareSheet, type ShareSubject } from '../../share'
import { downloadEach, isIOS, MAX_BATCH, supportsFileShare } from '../../shareFiles'
import { toast } from '../../toast'
import type { GalleryEvent, GalleryMedia, Paged } from '../../types'
import { useUploader } from '../../uploader'
import AccessGate from './AccessGate'
import { GalleryFrame, Notice } from './GalleryFrame'
import Lightbox from './Lightbox'
import { MediaTile } from './MediaTile'
import UploadPanel from './UploadPanel'

type TypeFilter = 'all' | 'photo' | 'video'

export default function Gallery() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  const key = params.get('k')

  const event = useQuery({ queryKey: ['gallery', slug], queryFn: () => api<GalleryEvent>(`/g/${slug}`) })

  const access = useMutation({
    mutationFn: (body: { key?: string; code?: string }) => api<GalleryEvent>(`/g/${slug}/access`, 'POST', body),
    onSuccess: (data) => qc.setQueryData(['gallery', slug], data),
    onError: () => { /* mostrado na página de entrada */ },
  })

  // Link/QR Code com a chave: entra logo e tira a chave do endereço (quem copiar o link do navegador não a leva).
  const tried = useRef(false)
  useEffect(() => {
    if (!key || !event.data || tried.current) return
    tried.current = true
    const clean = () => { params.delete('k'); setParams(params, { replace: true }) }
    if (event.data.access === 'needs_access') access.mutate({ key }, { onSettled: clean })
    else clean()
  }, [key, event.data, access, params, setParams])

  if (event.isLoading || (key && event.data?.access === 'needs_access' && !access.isError)) return <GalleryFrame><div className="flex justify-center py-24 text-cream/60"><Spinner label="A abrir a galeria…" /></div></GalleryFrame>
  if (event.error) return <Notice title="Galeria não encontrada" text="Confirme o link ou o QR Code com o organizador do evento." />
  const e = event.data!
  if (e.access === 'disabled') return <Notice title={e.title} text="Esta galeria está temporariamente indisponível. Volte a tentar mais tarde." />
  if (e.access === 'blocked') return <Notice title={e.title} text="O organizador retirou-lhe o acesso a esta galeria." />
  if (e.access === 'needs_access') return <AccessGate event={e} onSubmit={(code) => access.mutate({ code })} error={access.error} busy={access.isPending} />
  return <OpenGallery event={e} slug={slug} />
}

function OpenGallery({ event: e, slug }: { event: GalleryEvent; slug: string }) {
  const qc = useQueryClient()
  const [type, setType] = useState<TypeFilter>('all')
  const [sort, setSort] = useState<'new' | 'old'>('new')
  const [open, setOpen] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)

  const media = useInfiniteQuery({
    queryKey: ['gallery-media', slug, type, sort],
    queryFn: ({ pageParam }) => api<Paged<GalleryMedia>>(`/g/${slug}/media?${new URLSearchParams({ page: String(pageParam), sort, ...(type !== 'all' ? { type } : {}) })}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
    // Enquanto há envios próprios a preparar, actualiza depressa; senão, de vez em quando (chegam fotografias novas).
    refetchInterval: (q) => (q.state.data?.pages.some((p) => p.data.some((m) => m.status === 'processing')) ? 4000 : 30_000),
  })
  const items = useMemo(() => media.data?.pages.flatMap((p) => p.data) ?? [], [media.data])
  const total = media.data?.pages[0]?.total ?? 0

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['gallery-media', slug] })
    void qc.invalidateQueries({ queryKey: ['gallery', slug] })
  }, [qc, slug])
  const uploader = useUploader(`/g/${slug}/media`, e.rules, refresh)

  const remove = useMutation({
    mutationFn: (m: GalleryMedia) => api(`/g/${slug}/media/${m.id}`, 'DELETE'),
    onSuccess: () => { setOpen(null); toast('Apagado.'); refresh() },
  })

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = media
  const more = useCallback(() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage() }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  const sentinel = useCallback((el: HTMLElement | null) => {
    if (!el) return
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) more() }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [more])

  const shareUrl = `${location.origin}/g/${slug}`
  const canUpload = !!e.upload_enabled && !e.storage_full && !!e.rules
  // O link de uma galeria privada não leva a chave: só serve a quem já a tem. Partilha-se a galeria se for pública.
  const canShareGallery = e.visibility === 'public'

  // Selecção para descarregar ou partilhar vários de uma vez. Guarda os próprios itens: mudar o filtro não perde a selecção.
  const [selected, setSelected] = useState<Map<number, GalleryMedia> | null>(null)
  const selecting = selected !== null
  const chosen = useMemo(() => [...(selected?.values() ?? [])], [selected])
  const toggle = (m: GalleryMedia) => setSelected((cur) => {
    const next = new Map(cur)
    if (next.has(m.id)) next.delete(m.id)
    else if (next.size >= MAX_BATCH) { toast(`Pode seleccionar até ${MAX_BATCH} de cada vez.`); return cur }
    else if (m.download_url) next.set(m.id, m)
    return next
  })
  const stopSelecting = () => setSelected(null)

  const [share, setShare] = useState<ShareSubject | null>(null)
  const [saving, setSaving] = useState<GalleryMedia[] | null>(null)
  const shareGallery = () => setShare({ kind: 'link', url: shareUrl, title: e.title, text: `Veja e partilhe as fotografias e os vídeos de ${e.title}:` })
  const shareSelected = () => setShare({ kind: 'media', items: chosen, url: shareUrl, title: e.title })
  const saveSelected = () => {
    if (isIOS() && supportsFileShare()) setSaving(chosen)
    else { void downloadEach(chosen); stopSelecting() }
  }

  const sortToggle = (
    <button type="button" onClick={() => setSort(sort === 'new' ? 'old' : 'new')} aria-label={sort === 'new' ? 'Ordem: mais recentes primeiro. Tocar para ver as mais antigas primeiro.' : 'Ordem: mais antigas primeiro. Tocar para ver as mais recentes primeiro.'}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-cream/70 active:bg-white/10">
      <ArrowDownUp size={15} aria-hidden="true" />{sort === 'new' ? 'Mais recentes primeiro' : 'Mais antigas primeiro'}
    </button>
  )

  return (
    <GalleryFrame header={<></>}>
      <section className="relative isolate overflow-hidden">
        {e.cover_url && <img src={e.cover_url} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-45" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-night/30 via-night/70 to-night" />
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" aria-label="Página inicial"><Brand onDark /></Link>
            {e.is_manager && <Link to={e.manage_id ? `/eventos/${e.manage_id}` : '/eventos'} className="inline-flex h-11 items-center gap-2 rounded-xl bg-cream px-3.5 text-sm font-semibold text-ink hover:bg-white"><ArrowLeft size={16} aria-hidden="true" />Voltar à gestão</Link>}
          </div>
          <div className={`pb-10 ${e.cover_url ? 'pt-24 md:pt-40' : 'pt-10 md:pt-16'}`}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">Galeria do evento</p>
            <h1 className="mt-2 max-w-4xl font-display text-4xl font-semibold leading-[1.05] md:text-6xl">{e.title}</h1>
            <p className="mt-3 text-cream/75">{fmtLongDate(e.event_date)} · {EVENT_TYPES[e.event_type]}</p>
            {e.description && <p className="mt-4 max-w-2xl text-lg text-cream/85">{e.description}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {canUpload && <button onClick={() => setAdding(true)} className="inline-flex h-12 items-center gap-2 rounded-xl bg-coral px-5 font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"><ImagePlus size={20} aria-hidden="true" />Adicionar fotos e vídeos</button>}
              {canShareGallery && <button onClick={shareGallery} className="inline-flex h-12 items-center gap-2 rounded-xl bg-white/10 px-4 font-semibold transition hover:bg-white/20 active:scale-[0.98]"><Share2 size={18} aria-hidden="true" />Partilhar galeria</button>}
            </div>
            <p className="mt-3 text-sm text-cream/60">{plural(e.photos ?? 0, 'fotografia', 'fotografias')}{(e.videos ?? 0) > 0 && ` · ${plural(e.videos ?? 0, 'vídeo', 'vídeos')}`}</p>
            {!e.upload_enabled && <p className="mt-4 text-sm text-cream/60">O organizador fechou os envios. Pode continuar a ver e descarregar.</p>}
            {e.upload_enabled && e.storage_full && <p className="mt-4 text-sm text-cream/60">A galeria está cheia: não é possível enviar mais neste momento.</p>}
          </div>
        </div>
      </section>

      <div className="sticky top-0 z-20 border-b border-white/10 bg-night/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-2 md:px-8">
          {selecting ? (
            <>
              <button type="button" onClick={stopSelecting} className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 font-semibold active:bg-white/10"><X size={20} aria-hidden="true" />Cancelar</button>
              <span className="text-sm font-semibold tabular-nums" role="status">{chosen.length ? `${chosen.length} seleccionado${chosen.length === 1 ? '' : 's'}` : 'Toque para seleccionar'}</span>
            </>
          ) : (
            <>
              <Segmented dark value={type} onChange={setType} options={[{ value: 'all', label: 'Tudo' }, { value: 'photo', label: 'Fotos' }, ...(e.rules?.videos || (e.videos ?? 0) > 0 ? [{ value: 'video' as const, label: 'Vídeos' }] : [])]} />
              <div className="flex items-center gap-2">
                <div className="hidden sm:block"><Segmented dark value={sort} onChange={setSort} options={[{ value: 'new', label: 'Recentes' }, { value: 'old', label: 'Antigas' }]} /></div>
                {items.length > 0 && (
                  <button type="button" onClick={() => setSelected(new Map())} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3.5 text-sm font-semibold active:bg-white/20 hover:bg-white/20">
                    <CircleCheck size={18} aria-hidden="true" />Seleccionar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-2 pt-2 md:px-8 md:pt-6">
        {/* Telemóvel: a ordem fica por cima da grelha, para os filtros e o "Seleccionar" caberem numa só linha. */}
        {!selecting && items.length > 1 && <div className="mb-1 flex justify-end sm:hidden">{sortToggle}</div>}
        {media.isLoading ? <div className="flex justify-center py-16 text-cream/60"><Spinner /></div> : items.length === 0 ? (
          <div className="mx-auto max-w-md py-20 text-center">
            <Images size={40} className="mx-auto text-gold" aria-hidden="true" />
            <p className="mt-4 font-display text-2xl">Ainda não há nada aqui.</p>
            <p className="mt-2 text-cream/60">{canUpload ? 'Seja o primeiro a partilhar um momento da festa.' : 'Volte mais tarde.'}</p>
          </div>
        ) : (
          <>
            <div className="columns-2 gap-2 sm:columns-3 md:gap-3 lg:columns-4">
              {items.map((m, i) => <MediaTile key={m.id} m={m} selected={selected ? selected.has(m.id) : undefined} onOpen={() => (selecting ? toggle(m) : setOpen(i))} />)}
            </div>
            {hasNextPage && <div ref={sentinel} className="h-1" aria-hidden="true" />}
            {isFetchingNextPage && <div className="flex justify-center py-6 text-cream/50"><Loader2 className="animate-spin" aria-label="A carregar mais" /></div>}
            <p className="py-6 text-center text-sm text-cream/40">{items.length} de {total}</p>
          </>
        )}
      </main>

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-night/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
            <button type="button" disabled={!chosen.length} onClick={saveSelected} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white/10 font-semibold transition active:scale-[0.98] disabled:opacity-40"><Download size={20} aria-hidden="true" />Descarregar</button>
            <button type="button" disabled={!chosen.length} onClick={shareSelected} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-coral font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"><Share2 size={20} aria-hidden="true" />Partilhar</button>
          </div>
        </div>
      )}

      {canUpload && !adding && !selecting && (
        <button onClick={() => setAdding(true)} aria-label="Adicionar fotos e vídeos"
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-coral px-5 font-semibold text-white shadow-xl shadow-black/40 transition hover:brightness-110 active:scale-95 md:hidden">
          {uploader.busy ? <Loader2 size={22} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={22} aria-hidden="true" />}
          {uploader.busy ? 'A enviar…' : 'Adicionar'}
        </button>
      )}

      {e.rules && (
        <UploadPanel open={adding} onClose={() => setAdding(false)} rules={e.rules} moderated={e.moderation === 'manual' && !e.is_manager}
          askName={!e.is_manager} initialName={e.guest?.name ?? ''} uploader={uploader} />
      )}

      {open !== null && (
        <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} onNeedMore={more}
          onShare={(m) => setShare({ kind: 'media', items: [m], url: shareUrl, title: e.title })}
          onDelete={(m) => { if (confirm('Apagar esta fotografia/vídeo da galeria? Não se pode desfazer.')) remove.mutate(m) }} />
      )}

      <ShareSheet subject={share} onClose={() => setShare(null)} />
      <SaveSheet items={saving} onClose={() => { setSaving(null); stopSelecting() }} />
    </GalleryFrame>
  )
}
