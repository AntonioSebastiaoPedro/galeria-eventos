import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Check, Download, ImagePlus, Lock, QrCode, ShieldCheck, Smartphone } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Brand, buttonClass } from '../components'
import { fmtKz, fmtSize } from '../format'
import type { Plan } from '../types'
import { Mosaic } from './AuthLayout'

const STEPS = [
  { icon: QrCode, title: 'Crie o evento', text: 'Dê-lhe um nome, uma data e escolha se a galeria é pública ou privada. Recebe um link e um QR Code exclusivos.' },
  { icon: Smartphone, title: 'Os convidados leem o QR', text: 'Nas mesas, na entrada ou no convite. A galeria abre no telemóvel: sem instalar aplicações, sem criar conta.' },
  { icon: ImagePlus, title: 'Todos partilham', text: 'Cada convidado envia as fotografias e os vídeos que fez. No fim, tem o álbum completo da festa.' },
]

const FEATURES = [
  { icon: Lock, title: 'Galerias privadas', text: 'Só entra quem tem o link, o QR Code ou o código de acesso. Os ficheiros saem por ligações temporárias.' },
  { icon: ShieldCheck, title: 'Moderação', text: 'Publique logo ou aprove antes. Apague o que não deve estar lá e bloqueie quem não deve participar.' },
  { icon: Download, title: 'Tudo num ZIP', text: 'Descarregue todas as fotografias e vídeos, com a qualidade original, de uma só vez.' },
]

export default function Landing() {
  const { user } = useAuth()
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<Plan[]>('/plans') }).data ?? []

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 md:px-8">
        <Brand />
        <nav className="flex items-center gap-2">
          {user ? (
            <Link to="/eventos" className={buttonClass('primary')}>Os meus eventos</Link>
          ) : (
            <>
              <Link to="/entrar" className={buttonClass('ghost')}>Entrar</Link>
              <Link to="/criar-conta" className={buttonClass('primary', 'hidden sm:inline-flex')}>Criar conta</Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-8 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1 text-sm font-semibold text-coral ring-1 ring-line">Casamentos · Aniversários · Baptizados · Formaturas</p>
          <h1 className="font-display text-5xl font-semibold leading-[1.02] md:text-7xl">Memórias <em className="text-coral">partilhadas</em>.</h1>
          <p className="mt-6 max-w-xl text-lg text-ink-2 md:text-xl">Cada convidado tira fotografias e grava vídeos. Em vez de ficarem espalhados pelos telemóveis e grupos de WhatsApp, chegam todos ao mesmo álbum — por um link ou QR Code.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={user ? '/eventos/novo' : '/criar-conta'} className={buttonClass('coral', 'h-12! px-6! text-lg')}>Criar a galeria do meu evento</Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-2">
            {['Sem instalação', 'Partilha por QR Code', 'Galerias privadas'].map((t) => <li key={t} className="flex items-center gap-1.5"><Check size={16} className="text-leaf" aria-hidden="true" />{t}</li>)}
          </ul>
        </div>
        <div className="relative rounded-[2rem] bg-night p-5 shadow-2xl shadow-ink/20 md:p-7">
          <div className="mb-4 flex items-center justify-between text-cream">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-gold">Galeria do evento</div>
              <div className="font-display text-2xl font-semibold">Aniversário da Dicla</div>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm">128 fotos</span>
          </div>
          <Mosaic />
        </div>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-8">
          <h2 className="font-display text-4xl font-semibold">Como funciona</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <div className="mb-4 flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-2xl bg-gold text-gold-ink"><Icon size={22} aria-hidden="true" /></span><span className="font-display text-3xl text-ink-3">{i + 1}</span></div>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="mt-1 text-ink-2">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-3xl bg-canvas p-6">
                <Icon size={22} className="text-coral" aria-hidden="true" />
                <h3 className="mt-3 font-bold">{title}</h3>
                <p className="mt-1 text-sm text-ink-2">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {plans.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-20 md:px-8">
          <h2 className="font-display text-4xl font-semibold">Pague por evento</h2>
          <p className="mt-2 max-w-xl text-ink-2">Sem mensalidades. Comece grátis e escolha um plano quando precisar de mais espaço, de vídeos ou de descarregar tudo em ZIP.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <div key={p.key} className={`rounded-3xl p-6 ${p.key === 'premium' ? 'bg-ink text-cream' : 'border border-line bg-paper'}`}>
                <h3 className="font-bold">{p.name}</h3>
                <p className="mt-2 font-display text-3xl font-semibold">{fmtKz(p.price_kz)}</p>
                <p className={`text-sm ${p.key === 'premium' ? 'text-cream/60' : 'text-ink-3'}`}>por evento</p>
                <ul className="mt-5 space-y-2 text-sm">
                  <li>{fmtSize(p.storage_mb * 1024 * 1024)} de espaço</li>
                  <li>{p.max_photos ? `Até ${p.max_photos} fotografias` : 'Fotografias sem limite de número'}</li>
                  <li>{p.videos ? 'Fotografias e vídeos' : 'Sem vídeos'}</li>
                  <li>QR Code e link exclusivos</li>
                  {p.zip && <li>Descarregar tudo em ZIP</li>}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-ink-3 md:px-8">
          <Brand />
          <span>Os conteúdos pertencem a quem os partilhou e ao organizador do evento.</span>
        </div>
      </footer>
    </div>
  )
}
