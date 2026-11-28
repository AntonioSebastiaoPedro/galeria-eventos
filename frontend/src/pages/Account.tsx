import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { useAuth, type User } from '../auth'
import { ApiError } from '../api'
import { Button, Card, Field, PageHeader, PhoneField } from '../components'
import { phoneForInput } from '../format'
import { toast } from '../toast'

export default function Account() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [profile, setProfile] = useState({ name: user!.name, phone: phoneForInput(user!.phone), email: user!.email ?? '' })
  const [pw, setPw] = useState({ current_password: '', password: '', password_confirmation: '' })

  const saveProfile = useMutation({
    mutationFn: () => api<User>('/me', 'PUT', profile),
    onSuccess: (u) => { qc.setQueryData(['me'], u); toast('Dados guardados.') },
  })
  const fieldError = (k: string) => (saveProfile.error instanceof ApiError ? saveProfile.error.errors?.[k]?.[0] : undefined)
  const savePassword = useMutation({
    mutationFn: () => api('/change-password', 'POST', pw),
    onSuccess: () => { setPw({ current_password: '', password: '', password_confirmation: '' }); toast('Senha alterada.') },
  })

  return (
    <>
      <PageHeader title="Conta" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-bold">Os seus dados</h2>
          <form onSubmit={(e) => { e.preventDefault(); saveProfile.mutate() }}>
            <Field label="Nome" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
            <PhoneField label="Telemóvel" value={profile.phone} onChange={(phone) => setProfile({ ...profile, phone })} error={fieldError('phone')} hint="Para entrar na conta. Precisa do telemóvel, do e-mail ou dos dois." />
            <Field label="E-mail (opcional se tiver telemóvel)" type="email" autoComplete="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} error={fieldError('email')} hint="Com e-mail, recupera a senha sozinho e recebe os avisos por e-mail." />
            <Button disabled={saveProfile.isPending}>Guardar</Button>
          </form>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-bold">Alterar a senha</h2>
          <form onSubmit={(e) => { e.preventDefault(); savePassword.mutate() }}>
            <Field label="Senha atual" type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required />
            <Field label="Nova senha" type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} required minLength={8} />
            <Field label="Repetir a nova senha" type="password" autoComplete="new-password" value={pw.password_confirmation} onChange={(e) => setPw({ ...pw, password_confirmation: e.target.value })} required />
            <Button disabled={savePassword.isPending}>Alterar senha</Button>
          </form>
        </Card>
      </div>
    </>
  )
}
