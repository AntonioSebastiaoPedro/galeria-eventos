import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { ApiError } from './api'

// Avisos que flutuam por cima da página. Vive fora do React para o QueryClient (que também está fora) os poder chamar.
// success: algo ficou feito · error: algo falhou · info: aviso ou instrução (nem sucesso nem falha).
export type ToastKind = 'success' | 'error' | 'info'
interface Toast { id: number; message: string; kind: ToastKind }

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

// Fica o tempo de o ler: 4 s mais ~60 ms por letra (até 10 s); os erros nunca menos de 7 s.
const duration = (message: string, kind: ToastKind) => Math.min(10000, Math.max(kind === 'error' ? 7000 : 4000, 2500 + message.length * 60))

export function toast(message: string, kind: ToastKind = 'success') {
  const id = nextId++
  toasts = [...toasts.filter((t) => t.message !== message), { id, message, kind }].slice(-3)
  emit()
  setTimeout(() => dismissToast(id), duration(message, kind))
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
  toast(errorMessage(e), 'error')
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
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[1000] mx-auto flex max-w-md flex-col gap-2" aria-live="polite">
      {toasts.map((t) => {
        const { Icon, badge, ring } = LOOK[t.kind]
        return (
          // Três colunas, com as das pontas da mesma largura, para o texto ficar mesmo ao centro.
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto grid animate-drop grid-cols-[2.75rem_1fr_2.75rem] items-center gap-1 rounded-2xl bg-ink py-2 pl-2 pr-1 text-white shadow-xl shadow-black/30 ring-1 ${ring}`}>
            <span className={`mx-auto flex size-8 items-center justify-center rounded-full ${badge}`} aria-hidden="true">
              <Icon size={18} strokeWidth={2.25} />
            </span>
            <p className="py-1.5 text-center text-[15px] font-medium leading-snug text-balance sm:text-base">{t.message}</p>
            <button type="button" onClick={() => dismissToast(t.id)} aria-label="Fechar aviso"
              className="flex size-11 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

const LOOK = {
  success: { Icon: CircleCheck, badge: 'bg-leaf text-white', ring: 'ring-white/10' },
  info: { Icon: Info, badge: 'bg-gold text-gold-ink', ring: 'ring-white/10' },
  error: { Icon: CircleAlert, badge: 'bg-coral text-white', ring: 'ring-2 ring-coral' },
} satisfies Record<ToastKind, { Icon: typeof X; badge: string; ring: string }>
