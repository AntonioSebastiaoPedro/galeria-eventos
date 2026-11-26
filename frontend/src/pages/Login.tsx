import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Button, ErrorText, Field } from '../components'
import AuthLayout from './AuthLayout'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  return (
    <AuthLayout title="Entrar" subtitle="Para criar e gerir as galerias dos seus eventos. Os convidados não precisam de conta.">
      <form onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true); setError(null)
        try { await login(email.trim(), password); nav('/eventos') } catch (err) { setError(err) } finally { setBusy(false) }
      }}>
        <Field label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="Senha" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <ErrorText error={error} />
        <Button className="mt-2 w-full" disabled={busy}>{busy ? 'A entrar…' : 'Entrar'}</Button>
      </form>
      <p className="mt-6 text-sm"><Link to="/recuperar-senha" className="font-semibold text-ink-2 underline underline-offset-4">Esqueci-me da senha</Link></p>
      <div className="mt-8 rounded-2xl bg-wash p-4">
        <p className="font-semibold">Ainda não tem conta?</p>
        <p className="mb-3 mt-0.5 text-sm text-ink-2">Crie a galeria do seu evento em menos de um minuto.</p>
        <Link to="/criar-conta" className="inline-flex h-11 items-center rounded-xl border border-line bg-paper px-5 font-semibold hover:bg-white md:h-10">Criar conta</Link>
      </div>
    </AuthLayout>
  )
}
