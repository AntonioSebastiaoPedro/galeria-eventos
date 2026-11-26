import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, Search, Undo2 } from 'lucide-react'
import { api } from '../../api'
import { Button, EmptyState, Modal, Spinner } from '../../components'
import { fmtRelative } from '../../format'
import { usePaged } from '../../pagination'
import { toast } from '../../toast'
import type { Guest } from '../../types'
import { useDebounced } from '../../useDebounced'
import { useEvent } from './useEvent'

// Convidados que entraram na galeria e o que partilharam. Bloquear impede de ver e de enviar.
export default function EventGuests() {
  const e = useEvent()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const path = `/events/${e.id}/guests`
  const { rows, isLoading, footer } = usePaged<Guest>(path, q ? { search: q } : {})
  const [blocking, setBlocking] = useState<Guest | null>(null)
  const [removeMedia, setRemoveMedia] = useState(false)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: [path] })
    void qc.invalidateQueries({ queryKey: [`/events/${e.id}/media`] })
    void qc.invalidateQueries({ queryKey: ['event', String(e.id)] })
  }
  const block = useMutation({
    mutationFn: () => api(`/guests/${blocking!.id}/block`, 'POST', { remove_media: removeMedia }),
    onSuccess: () => { toast('Convidado bloqueado.'); setBlocking(null); refresh() },
  })
  const unblock = useMutation({ mutationFn: (g: Guest) => api(`/guests/${g.id}/unblock`, 'POST'), onSuccess: () => { toast('Bloqueio retirado.'); refresh() } })

  return (
    <>
      <div className="relative mb-5 max-w-sm">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input type="search" value={search} onChange={(ev) => setSearch(ev.target.value)} placeholder="Procurar pelo nome" aria-label="Procurar convidados"
          className="h-11 w-full rounded-xl border border-line bg-paper pl-10 pr-4 focus:border-ink focus:outline-none" />
      </div>
      <p className="mb-4 max-w-2xl text-sm text-ink-2">Os convidados não têm conta: são reconhecidos pelo navegador onde abriram a galeria e pelo nome que escreveram (não verificado).</p>

      {isLoading ? <Spinner /> : !rows.length ? <EmptyState title={q ? 'Nenhum convidado com esse nome' : 'Ainda ninguém entrou na galeria'} /> : (
        <div className="overflow-hidden rounded-3xl border border-line bg-paper">
          <ul className="divide-y divide-line">
            {rows.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
                <div className="min-w-0">
                  <p className="font-semibold">{g.name ?? 'Sem nome'} {g.blocked && <span className="ml-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">Bloqueado</span>}</p>
                  <p className="text-sm text-ink-3">{plural(g.photos, 'fotografia')} · {plural(g.videos, 'vídeo')}{g.last_seen_at && ` · visto ${fmtRelative(g.last_seen_at)}`}</p>
                </div>
                {g.blocked
                  ? <Button variant="soft" onClick={() => unblock.mutate(g)}><Undo2 size={16} aria-hidden="true" />Desbloquear</Button>
                  : <Button variant="ghost" className="text-danger" onClick={() => { setRemoveMedia(false); setBlocking(g) }}><Ban size={16} aria-hidden="true" />Bloquear</Button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {footer}

      <Modal open={!!blocking} onClose={() => setBlocking(null)} title={`Bloquear ${blocking?.name ?? 'convidado'}?`}>
        <p className="text-ink-2">Deixa de conseguir ver a galeria e de enviar fotografias a partir deste navegador.</p>
        <label className="mt-4 flex items-start gap-3 rounded-2xl bg-wash p-4">
          <input type="checkbox" className="mt-1 size-5 accent-coral" checked={removeMedia} onChange={(ev) => setRemoveMedia(ev.target.checked)} />
          <span><span className="block font-semibold">Apagar também o que enviou</span><span className="text-sm text-ink-2">{blocking && `${plural(blocking.photos, 'fotografia')} e ${plural(blocking.videos, 'vídeo')}. Não se pode desfazer.`}</span></span>
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setBlocking(null)}>Cancelar</Button>
          <Button variant="danger" disabled={block.isPending} onClick={() => block.mutate()}>Bloquear</Button>
        </div>
      </Modal>
    </>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
