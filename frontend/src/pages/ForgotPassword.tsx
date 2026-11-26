import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Button, ErrorText, Field } from '../components'
import AuthLayout from './AuthLayout'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  return (
    <AuthLayout title="Recuperar a senha" subtitle="Enviamos uma ligação para escolher uma nova senha.">
      {sent ? (
        <div className="rounded-2xl bg-leaf-soft p-4 text-leaf">
          <p className="font-semibold">Verifique o seu e-mail.</p>
          <p className="mt-1 text-sm">Se existir uma conta com {email}, a ligação chega dentro de instantes.</p>
        </div>
      ) : (
        <form onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true); setError(null)
          try { await api('/forgot-password', 'POST', { email: email.trim() }); setSent(true) } catch (err) { setError(err) } finally { setBusy(false) }
        }}>
          <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <ErrorText error={error} />
          <Button className="mt-2 w-full" disabled={busy}>{busy ? 'A enviar…' : 'Enviar ligação'}</Button>
        </form>
      )}
      <p className="mt-6 text-sm"><Link to="/entrar" className="font-semibold text-ink-2 underline underline-offset-4">Voltar a entrar</Link></p>
    </AuthLayout>
  )
}
