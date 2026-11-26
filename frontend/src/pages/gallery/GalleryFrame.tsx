import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '../../components'

// Moldura escura das páginas dos convidados: as fotografias sobressaem sobre o fundo.
export function GalleryFrame({ children, header }: { children: ReactNode; header?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-night text-cream">
      {header ?? (
        <header className="mx-auto flex h-16 max-w-7xl items-center px-4 md:px-8"><Link to="/" aria-label="Página inicial"><Brand onDark /></Link></header>
      )}
      {children}
      <footer className="mx-auto max-w-7xl px-4 pb-28 pt-12 text-center text-xs text-cream/40 md:px-8">
        Ao partilhar, confirma que pode publicar estas imagens e que as pessoas fotografadas concordam.
        <br />Criado com <Link to="/" className="underline underline-offset-2">Galeria</Link>.
      </footer>
    </div>
  )
}

export function Notice({ title, text }: { title: string; text: string }) {
  return (
    <GalleryFrame>
      <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col justify-center px-5 text-center">
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="mt-3 text-cream/70">{text}</p>
      </div>
    </GalleryFrame>
  )
}
