import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Button, ErrorText, Field } from '../components'
import AuthLayout from './AuthLayout'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  return (
    <AuthLayout title="Nova senha" subtitle={params.get('email') ?? ''}>
      {done ? (
        <div className="rounded-2xl bg-leaf-soft p-4 text-leaf">
          <p className="font-semibold">Senha alterada.</p>
          <Link to="/entrar" className="mt-2 inline-block font-semibold underline underline-offset-4">Entrar</Link>
        </div>
      ) : (
        <form onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true); setError(null)
          try {
            await api('/reset-password', 'POST', { email: params.get('email'), token: params.get('token'), password, password_confirmation: confirmation })
            setDone(true)
          } catch (err) { setError(err) } finally { setBusy(false) }
        }}>
          <Field label="Nova senha" type="password" autoComplete="new-password" hint="Pelo menos 8 caracteres." value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          <Field label="Repetir a senha" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
          <ErrorText error={error} />
          <Button className="mt-2 w-full" disabled={busy}>{busy ? 'A guardar…' : 'Guardar senha'}</Button>
        </form>
      )}
    </AuthLayout>
  )
}
