import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { Card, PageHeader } from '../../components'
import type { ManagedEvent } from '../../types'
import EventForm from './EventForm'
import { formPayload, toForm } from './eventFormValues'

export default function NewEvent() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: (v: ReturnType<typeof formPayload>) => api<ManagedEvent>('/events', 'POST', v),
    onSuccess: (e) => { void qc.invalidateQueries({ queryKey: ['events'] }); nav(`/eventos/${e.id}`) },
  })

  return (
    <>
      <PageHeader title="Novo evento" subtitle="No fim recebe o link e o QR Code da galeria. Pode mudar tudo depois." />
      <Card>
        <EventForm initial={toForm()} onSubmit={(v) => create.mutate(formPayload(v))} busy={create.isPending} error={create.error} submitLabel="Criar evento" />
      </Card>
    </>
  )
}
