import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { ApiError } from '../api'
import { Button, ErrorText, Field } from '../components'
import AuthLayout from './AuthLayout'

export default function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '' })
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  const fieldError = (k: string) => (error instanceof ApiError ? error.errors?.[k]?.[0] : undefined)

  return (
    <AuthLayout title="Criar conta" subtitle="Para organizar eventos. O primeiro evento é gratuito.">
      <form onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true); setError(null)
        try { await register({ ...form, email: form.email.trim() }); nav('/eventos/novo') } catch (err) { setError(err) } finally { setBusy(false) }
      }}>
        <Field label="Nome" autoComplete="name" value={form.name} onChange={set('name')} error={fieldError('name')} required />
        <Field label="E-mail" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={fieldError('email')} required />
        <Field label="Senha" type="password" autoComplete="new-password" hint="Pelo menos 8 caracteres." value={form.password} onChange={set('password')} error={fieldError('password')} required minLength={8} />
        <Field label="Repetir a senha" type="password" autoComplete="new-password" value={form.password_confirmation} onChange={set('password_confirmation')} required />
        {!(error instanceof ApiError && error.errors) && <ErrorText error={error} />}
        <Button className="mt-2 w-full" disabled={busy}>{busy ? 'A criar…' : 'Criar conta'}</Button>
      </form>
      <p className="mt-6 text-sm text-ink-2">Já tem conta? <Link to="/entrar" className="font-semibold text-ink underline underline-offset-4">Entrar</Link></p>
    </AuthLayout>
  )
}
