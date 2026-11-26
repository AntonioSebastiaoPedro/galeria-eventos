import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Button, ErrorText } from '../../components'
import { EVENT_TYPES, fmtLongDate } from '../../format'
import type { GalleryEvent } from '../../types'
import { GalleryFrame } from './GalleryFrame'

// Galeria privada sem acesso: entra-se com o código do organizador (ou pelo link/QR Code, que já traz a chave).
export default function AccessGate({ event, onSubmit, error, busy }: { event: GalleryEvent; onSubmit: (code: string) => void; error: unknown; busy: boolean }) {
  const [code, setCode] = useState('')
  return (
    <GalleryFrame>
      <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-5 py-16 text-center">
        <span className="mx-auto mb-6 flex size-16 items-center justify-center rounded-3xl bg-white/10 text-gold"><Lock size={28} aria-hidden="true" /></span>
        <p className="text-sm font-semibold uppercase tracking-widest text-gold">{EVENT_TYPES[event.event_type]} · {fmtLongDate(event.event_date)}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">{event.title}</h1>
        <p className="mt-3 text-cream/70">Esta galeria é privada.{event.has_access_code ? ' Escreva o código de acesso que recebeu do organizador.' : ' Use o link ou o QR Code que recebeu do organizador.'}</p>
        {event.has_access_code && (
          <form className="mt-8 text-left" onSubmit={(e) => { e.preventDefault(); onSubmit(code.trim()) }}>
            <label className="mb-2 block text-sm font-semibold" htmlFor="code">Código de acesso</label>
            <input id="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="none" required
              className="mb-4 h-12 w-full rounded-xl border border-white/20 bg-white/5 px-4 text-lg tracking-widest text-cream placeholder:text-cream/40 focus:border-gold focus:outline-none" />
            <ErrorText error={error} />
            <Button variant="coral" className="w-full" disabled={busy || !code.trim()}>{busy ? 'A verificar…' : 'Entrar na galeria'}</Button>
          </form>
        )}
        {!event.has_access_code && <ErrorText error={error} />}
      </div>
    </GalleryFrame>
  )
}
