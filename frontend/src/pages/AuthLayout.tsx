import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '../components'

// Um mosaico de "fotografias" (blocos de cor) que vão chegando, como numa galeria a encher-se.
const TILES = ['#d9472b', '#e9b949', '#2f6b4f', '#c97b84', '#5e81ac', '#efe6da', '#4a423b', '#e9b949', '#d9472b', '#2f6b4f', '#efe6da', '#c97b84']

export function Mosaic({ className = '' }: { className?: string }) {
  return (
    <div className={`grid grid-cols-4 gap-2.5 ${className}`} aria-hidden="true">
      {TILES.map((c, i) => (
        <span key={i} className={`animate-rise rounded-xl ${i % 5 === 0 ? 'row-span-2' : ''}`} style={{ background: c, animationDelay: `${i * 70}ms`, minHeight: 64 }} />
      ))}
    </div>
  )
}

export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[5fr_4fr] lg:bg-canvas">
      <section className="hidden flex-col justify-between overflow-hidden bg-night p-12 text-cream lg:flex xl:p-16">
        <Link to="/"><Brand onDark /></Link>
        <div>
          <Mosaic className="max-w-xl" />
          <h2 className="mt-10 max-w-lg font-display text-5xl font-semibold leading-[1.05]">Todas as fotografias da festa, num só álbum.</h2>
          <p className="mt-4 max-w-md text-lg text-cream/70">Os convidados leem o QR Code e partilham. Sem instalar nada, sem criar conta.</p>
        </div>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-10 inline-block lg:hidden"><Brand /></Link>
          <h1 className="font-display text-4xl font-semibold">{title}</h1>
          <p className="mb-8 mt-2 text-ink-2">{subtitle}</p>
          {children}
        </div>
      </section>
    </div>
  )
}
