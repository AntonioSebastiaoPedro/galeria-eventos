import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ImageUp, Trash2 } from 'lucide-react'
import { api } from '../../api'
import { Button, Card, Field, Modal } from '../../components'
import { toast } from '../../toast'
import type { ManagedEvent } from '../../types'
import EventForm from './EventForm'
import { formPayload, toForm } from './eventFormValues'
import { useEvent } from './useEvent'

export default function EventSettings() {
  const e = useEvent()
  const qc = useQueryClient()
  const nav = useNavigate()
  const coverInput = useRef<HTMLInputElement>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const saved = (x: ManagedEvent) => { qc.setQueryData(['event', String(e.id)], x); void qc.invalidateQueries({ queryKey: ['events'] }) }

  const update = useMutation({ mutationFn: (body: object) => api<ManagedEvent>(`/events/${e.id}`, 'PUT', body), onSuccess: (x) => { saved(x); toast('Definições guardadas.') } })
  const cover = useMutation({
    mutationFn: (file: File) => { const f = new FormData(); f.append('cover', file); return api<ManagedEvent>(`/events/${e.id}/cover`, 'POST', f) },
    onSuccess: (x) => { saved(x); toast('Capa actualizada.') },
  })
  const removeCover = useMutation({ mutationFn: () => api<ManagedEvent>(`/events/${e.id}/cover`, 'DELETE'), onSuccess: saved })
  const destroy = useMutation({
    mutationFn: () => api(`/events/${e.id}`, 'DELETE', { confirm: confirmTitle }),
    onSuccess: () => { qc.removeQueries({ queryKey: ['event', String(e.id)] }); void qc.invalidateQueries({ queryKey: ['events'] }); toast('Evento apagado.'); nav('/eventos') },
  })

  return (
    <div className="space-y-6">
      <Card>
        <EventForm key={e.id} initial={toForm(e)} event={e} onSubmit={(v) => update.mutate(formPayload(v))} busy={update.isPending} error={update.error} submitLabel="Guardar alterações" />
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Imagem de capa</h2>
        <p className="mt-1 text-sm text-ink-2">Aparece no topo da galeria, por trás do nome do evento.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="aspect-[16/9] w-56 overflow-hidden rounded-2xl bg-wash">{e.cover_url && <img src={e.cover_url} alt="Capa actual" className="size-full object-cover" />}</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="soft" disabled={cover.isPending} onClick={() => coverInput.current?.click()}><ImageUp size={18} aria-hidden="true" />{cover.isPending ? 'A enviar…' : e.cover_url ? 'Trocar capa' : 'Escolher capa'}</Button>
            {e.cover_url && <Button variant="ghost" onClick={() => removeCover.mutate()}>Remover</Button>}
          </div>
          <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) cover.mutate(f); ev.target.value = '' }} />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Disponibilidade</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-xl text-sm text-ink-2">{e.status === 'active'
            ? 'A galeria está activa. Desactivar fecha-a temporariamente aos convidados (nada é apagado).'
            : 'A galeria está desactivada: os convidados veem um aviso. Só o organizador a consegue abrir.'}</p>
          <Button variant={e.status === 'active' ? 'soft' : 'primary'} disabled={update.isPending} onClick={() => update.mutate({ status: e.status === 'active' ? 'disabled' : 'active' })}>
            {e.status === 'active' ? 'Desactivar a galeria' : 'Reactivar a galeria'}
          </Button>
        </div>
      </Card>

      <Card className="border-danger/30!">
        <h2 className="text-lg font-bold text-danger">Apagar o evento</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-xl text-sm text-ink-2">Apaga a galeria e todas as fotografias, vídeos e ZIP. Descarregue antes o que quiser guardar.</p>
          <Button variant="danger" onClick={() => { setConfirmTitle(''); setDeleting(true) }}><Trash2 size={18} aria-hidden="true" />Apagar evento</Button>
        </div>
      </Card>

      <Modal open={deleting} onClose={() => setDeleting(false)} title="Apagar o evento?">
        <p className="mb-4 text-ink-2">Todas as fotografias e vídeos são eliminados de forma definitiva. Para confirmar, escreva o nome do evento: <strong>{e.title}</strong></p>
        <Field label="Nome do evento" value={confirmTitle} onChange={(ev) => setConfirmTitle(ev.target.value)} autoComplete="off" />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(false)}>Cancelar</Button>
          <Button variant="danger" disabled={confirmTitle.trim() !== e.title.trim() || destroy.isPending} onClick={() => destroy.mutate()}>Apagar definitivamente</Button>
        </div>
      </Modal>
    </div>
  )
}
