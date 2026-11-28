import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { api } from '../api'
import { Button, ErrorText, Field } from '../components'
import { fmtPhone, whatsappLink } from '../format'
import type { AppSettings } from '../types'
import AuthLayout from './AuthLayout'

// Com e-mail: ligação para escolher nova senha. Com telemóvel: sem SMS no MVP, a equipa repõe a senha
// pelo WhatsApp (Administração → Contas → Repor senha).
export default function ForgotPassword() {
  const [login, setLogin] = useState('')
  const [result, setResult] = useState<'email' | 'phone' | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<AppSettings>('/settings') }).data

  return (
    <AuthLayout title="Recuperar a senha" subtitle="Escreva o telemóvel ou o e-mail da sua conta.">
      {result === 'email' ? (
        <div className="rounded-2xl bg-leaf-soft p-4 text-leaf">
          <p className="font-semibold">Verifique o seu e-mail.</p>
          <p className="mt-1 text-sm">Se existir uma conta com {login.trim()}, a ligação chega dentro de instantes.</p>
        </div>
      ) : result === 'phone' ? (
        <div className="rounded-2xl bg-wash p-4">
          <p className="font-semibold">Peça uma nova senha pelo WhatsApp</p>
          <p className="mt-1 text-sm text-ink-2">Para contas com telemóvel, a equipa da Galeria confirma que é o dono da conta e envia-lhe uma senha temporária. Depois de entrar, mude-a em Conta.</p>
          {settings?.support_phone ? (
            <a href={whatsappLink(settings.support_phone, `Olá! Esqueci-me da senha da minha conta da Galeria (telemóvel ${login.trim()}).`)} target="_blank" rel="noreferrer"
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] font-semibold text-white">
              <MessageCircle size={20} aria-hidden="true" />Falar no WhatsApp ({fmtPhone(settings.support_phone)})
            </a>
          ) : <p className="mt-3 text-sm font-semibold">Contacte a equipa da Galeria.</p>}
        </div>
      ) : (
        <form onSubmit={async (e) => {
          e.preventDefault()
          if (!login.includes('@')) { setResult('phone'); return }
          setBusy(true); setError(null)
          try { await api('/forgot-password', 'POST', { email: login.trim() }); setResult('email') } catch (err) { setError(err) } finally { setBusy(false) }
        }}>
          <Field label="Telemóvel ou e-mail" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={login} onChange={(e) => setLogin(e.target.value)} required />
          <ErrorText error={error} />
          <Button className="mt-2 w-full" disabled={busy}>{busy ? 'A enviar…' : 'Continuar'}</Button>
        </form>
      )}
      <p className="mt-6 text-sm"><Link to="/entrar" className="font-semibold text-ink-2 underline underline-offset-4">Voltar a entrar</Link></p>
    </AuthLayout>
  )
}
