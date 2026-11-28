import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api'
import { Button, Field, Segmented, Select, TextArea, Toggle } from '../../components'
import { EVENT_TYPES } from '../../format'
import type { ManagedEvent } from '../../types'
import type { EventFormValues } from './eventFormValues'

// Formulário do evento: o mesmo para criar e para editar.
export default function EventForm({ initial, event, onSubmit, busy, error, submitLabel }: {
  initial: EventFormValues; event?: ManagedEvent; onSubmit: (v: EventFormValues) => void; busy: boolean; error: unknown; submitLabel: string
}) {
  const [v, setV] = useState(initial)
  const set = <K extends keyof EventFormValues>(k: K, value: EventFormValues[K]) => setV((old) => ({ ...old, [k]: value }))
  const err = (k: string) => (error instanceof ApiError ? error.errors?.[k]?.[0] : undefined)
  const planHasVideos = event ? event.plan.videos : false

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(v) }} className="grid gap-x-10 lg:grid-cols-2">
      <div>
        <h2 className="mb-4 text-lg font-bold">O evento</h2>
        <Field label="Nome do evento" placeholder="Ex.: Aniversário do Ansebast" value={v.title} onChange={(e) => set('title', e.target.value)} error={err('title')} maxLength={120} required />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Select label="Tipo de evento" value={v.event_type} onChange={(e) => set('event_type', e.target.value)} error={err('event_type')}>
            {Object.entries(EVENT_TYPES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
          <Field label="Data" type="date" value={v.event_date} onChange={(e) => set('event_date', e.target.value)} error={err('event_date')} required />
        </div>
        <TextArea label="Mensagem para os convidados (opcional)" placeholder="Ex.: Partilhem as vossas fotografias da noite!" value={v.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-bold">Acesso e envios</h2>
        <div className="mb-4">
          <span className="mb-1.5 block text-sm font-semibold">Quem pode ver a galeria</span>
          <Segmented value={v.visibility} onChange={(x) => set('visibility', x)} options={[{ value: 'private', label: 'Privada' }, { value: 'public', label: 'Pública' }]} />
          <p className="mt-2 text-sm text-ink-2">
            {v.visibility === 'private'
              ? 'Só entra quem tiver o link ou o QR Code (que levam uma chave secreta) ou o código de acesso.'
              : 'Qualquer pessoa com o link pode ver. O link não aparece em pesquisas nem em listas.'}
          </p>
        </div>
        {v.visibility === 'private' && (
          <>
            <Field label={event?.has_access_code ? 'Alterar o código de acesso' : 'Código de acesso (opcional)'} value={v.access_code} onChange={(e) => set('access_code', e.target.value)} error={err('access_code')}
              hint={event?.has_access_code ? 'Já existe um código. Deixe vazio para o manter.' : 'Para dizer de viva voz ou escrever num cartaz, além do QR Code. Mínimo 4 caracteres.'} autoComplete="off" maxLength={32} />
            {event?.has_access_code && (
              <label className="-mt-2 mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={v.remove_access_code} onChange={(e) => set('remove_access_code', e.target.checked)} className="size-4 accent-coral" />Remover o código de acesso</label>
            )}
          </>
        )}
        <div className="rounded-2xl border border-line bg-paper px-4">
          <Toggle label="Aceitar envios dos convidados" hint="Desligue para encerrar os envios; a galeria continua visível." checked={v.upload_enabled} onChange={(x) => set('upload_enabled', x)} />
          <Toggle label="Aceitar vídeos" hint={event && !planHasVideos ? 'O plano deste evento não inclui vídeos.' : 'Os vídeos ocupam muito mais espaço do que as fotografias.'} checked={v.allow_videos && (!event || planHasVideos)} disabled={!!event && !planHasVideos} onChange={(x) => set('allow_videos', x)} />
          <Toggle label="Aprovar antes de publicar" hint="O que os convidados enviam só aparece na galeria depois de o aprovar." checked={v.moderation === 'manual'} onChange={(x) => set('moderation', x ? 'manual' : 'auto')} />
        </div>
      </div>

      <div className="mt-8 lg:col-span-2">
        <Button variant="coral" disabled={busy} className="w-full sm:w-auto">{busy ? 'A guardar…' : submitLabel}</Button>
      </div>
    </form>
  )
}
