import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { ApiError } from './api'

// Avisos que flutuam por cima da página. Vive fora do React para o QueryClient (que também está fora) os poder chamar.
interface Toast { id: number; message: string }

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function toast(message: string) {
  const id = nextId++
  toasts = [...toasts.filter((t) => t.message !== message), { id, message }].slice(-3)
  emit()
  setTimeout(() => dismissToast(id), 7000)
}

// Leva a página ao primeiro campo com erro, para a mensagem ser vista sem procurar.
export function revealFirstError() {
  setTimeout(() => {
    const el = document.querySelector<HTMLElement>('[aria-invalid="true"], [data-error]')
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') el.focus({ preventScroll: true })
  }, 60) // espera o React desenhar os erros
}

// A primeira mensagem de validação, ou a mensagem geral do erro.
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError && e.errors) {
    const first = Object.values(e.errors).flat()[0]
    if (first) return first
  }
  return e instanceof Error ? e.message : 'Algo correu mal. Tente outra vez.'
}

export function notifyError(e: unknown) {
  toast(errorMessage(e))
  revealFirstError()
}

export function Toaster() {
  const [, tick] = useState(0)
  useEffect(() => {
    const l = () => tick((n) => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[1000] mx-auto flex max-w-md flex-col gap-2" aria-live="assertive">
      {toasts.map((t) => (
        <div key={t.id} role="alert" className="pointer-events-auto flex items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg ring-2 ring-coral">
          <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
          <p className="flex-1 pt-0.5 text-sm font-medium">{t.message}</p>
          <button type="button" onClick={() => dismissToast(t.id)} aria-label="Fechar aviso"
            className="-my-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform hover:-translate-y-0.5 hover:bg-white/10">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}
