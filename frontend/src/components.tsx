import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowLeft, CalendarHeart, Eye, EyeOff, LogOut, ShieldCheck, UserRound, X } from 'lucide-react'
import { useAuth, type Role } from './auth'

/* ───────── Marca ───────── */

// Duas fotografias sobrepostas, uma com o sol da festa.
export function Logo({ size = 32, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="10" y="17" width="30" height="34" rx="4" fill={onDark ? '#4a423b' : '#e4dacc'} transform="rotate(-10 25 34)" />
      <rect x="21" y="12" width="30" height="35" rx="4" fill="#fffdf9" stroke={onDark ? '#fffdf9' : '#1f1a16'} strokeWidth="2.5" />
      <rect x="25" y="16" width="22" height="20" rx="2" fill="#d9472b" />
      <circle cx="41" cy="21.5" r="3" fill="#e9b949" />
    </svg>
  )
}

export function Brand({ onDark = false, className = '' }: { onDark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Logo size={30} onDark={onDark} />
      <span className="font-display text-xl font-semibold">Galeria</span>
    </span>
  )
}

/* ───────── Área do organizador ───────── */

type NavItem = { to: string; label: string; icon: typeof UserRound; end?: boolean }
const NAV: Record<Role, NavItem[]> = {
  organizer: [
    { to: '/eventos', label: 'Eventos', icon: CalendarHeart },
    { to: '/conta', label: 'Conta', icon: UserRound },
  ],
  superadmin: [
    { to: '/eventos', label: 'Eventos', icon: CalendarHeart },
    { to: '/admin', label: 'Administração', icon: ShieldCheck },
    { to: '/conta', label: 'Conta', icon: UserRound },
  ],
}

// Páginas secundárias: para onde o botão de voltar leva.
const PARENTS: { match: RegExp; to: string; label: string }[] = [
  { match: /^\/eventos\/novo$/, to: '/eventos', label: 'Eventos' },
  { match: /^\/eventos\/\d+(\/.*)?$/, to: '/eventos', label: 'Eventos' },
]

export function Layout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  if (!user) return null
  const items = NAV[user.role]
  const back = PARENTS.find((p) => p.match.test(pathname))
  const out = () => { void logout() }

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[4.5rem] flex-col border-r border-line bg-paper md:flex lg:w-64">
        <Link to="/" aria-label="Galeria, página inicial" className="flex h-16 items-center justify-center lg:justify-start lg:px-6"><Logo /><span className="ml-2 hidden font-display text-xl font-semibold lg:inline">Galeria</span></Link>
        <nav className="flex flex-1 flex-col gap-1 px-3 pt-2" aria-label="Principal">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} title={label}
              className={({ isActive }) => `flex h-11 items-center justify-center gap-3 rounded-xl text-[0.95rem] font-medium transition-colors lg:justify-start lg:px-3 ${isActive ? 'bg-ink text-white' : 'text-ink-2 hover:bg-wash'}`}>
              <Icon size={20} aria-hidden="true" /><span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className="hidden px-1 py-3 lg:block">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="truncate text-xs text-ink-3">{user.email}</div>
          </div>
          <button onClick={out} title="Terminar sessão" className="flex h-11 w-full items-center justify-center gap-3 rounded-xl text-sm font-medium text-ink-2 hover:bg-wash lg:justify-start lg:px-3">
            <LogOut size={20} aria-hidden="true" /><span className="hidden lg:inline">Terminar sessão</span>
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur md:hidden">
        {back ? (
          <Link to={back.to} className="-ml-2 flex h-11 items-center gap-1.5 rounded-xl pr-3 pl-2 font-semibold active:bg-wash"><ArrowLeft size={20} aria-hidden="true" />{back.label}</Link>
        ) : <Link to="/" aria-label="Galeria, página inicial" className="-ml-1 rounded-xl p-1"><Brand /></Link>}
        <button onClick={out} aria-label="Terminar sessão" className="flex size-11 items-center justify-center rounded-full text-ink-2 active:bg-wash"><LogOut size={20} /></button>
      </header>

      <main className="pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-[4.5rem] lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-9"><Outlet /></div>
      </main>

      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `flex h-[4.25rem] flex-1 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium ${isActive ? 'text-ink' : 'text-ink-3'}`}>
            {({ isActive }) => (
              <>
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-gold' : ''}`}><Icon size={21} aria-hidden="true" /></span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/* ───────── Estrutura de página ───────── */

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-sm font-semibold text-coral">{eyebrow}</div>}
        <h1 className="font-display text-[2rem] font-semibold leading-tight md:text-[2.75rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-2">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

export const EmptyState = ({ title, hint, action, icon }: { title: string; hint?: ReactNode; action?: ReactNode; icon?: ReactNode }) => (
  <div className="rounded-3xl border border-dashed border-line px-6 py-14 text-center">
    {icon && <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-wash text-ink-2">{icon}</div>}
    <p className="font-semibold">{title}</p>
    {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">{hint}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
)

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  // min-w-0: dentro de uma grelha, o conteúdo não pode alargar a coluna para lá do ecrã.
  // Um fundo dado em className (ex.: bg-night) substitui o fundo claro, em vez de competir com ele.
  <section className={`min-w-0 rounded-3xl p-4 sm:p-5 md:p-6 ${/\bbg-/.test(className) ? '' : 'border border-line bg-paper'} ${className}`}>{children}</section>
)

export const Spinner = ({ label = 'A carregar…' }: { label?: string }) => (
  <p className="flex items-center gap-2 py-8 text-ink-3" role="status"><span className="size-4 animate-spin rounded-full border-2 border-line border-t-coral" aria-hidden="true" />{label}</p>
)

/* ───────── Controlos ───────── */

type Variant = 'primary' | 'coral' | 'soft' | 'ghost' | 'danger' | 'light'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-2',
  coral: 'bg-coral text-white hover:brightness-110',
  soft: 'border border-line bg-paper text-ink hover:bg-wash',
  ghost: 'text-ink-2 hover:bg-wash',
  danger: 'bg-danger text-white hover:brightness-110',
  light: 'bg-cream text-ink hover:bg-white',
}

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button {...p} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition-[background,filter,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 md:h-10 ${VARIANTS[variant]} ${className}`} />
  )
}

export const buttonClass = (variant: Variant = 'primary', extra = '') =>
  `inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition-[background,filter,transform] active:scale-[0.98] md:h-10 ${VARIANTS[variant]} ${extra}`

const inputClass = 'w-full rounded-xl border border-line bg-paper px-4 text-base placeholder:text-ink-3 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15 aria-[invalid=true]:border-danger'

function FieldShell({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
      {error && <span className="mt-1 block text-sm text-danger">{error}</span>}
    </label>
  )
}

export function Field({ label, hint, error, type, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string }) {
  const [shown, setShown] = useState(false)
  const isPassword = type === 'password'
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <span className="relative block">
        <input {...rest} type={isPassword && shown ? 'text' : type} aria-invalid={!!error} className={`h-12 md:h-11 ${inputClass} ${isPassword ? 'pr-12' : ''}`} />
        {isPassword && (
          <button type="button" onClick={() => setShown((v) => !v)} aria-label={shown ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={shown}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-ink-3 hover:text-ink">
            {shown ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        )}
      </span>
    </FieldShell>
  )
}

// Telemóvel: o indicativo de Angola (+244) aparece fixo à esquerda. Um número começado por "+" ou "00"
// (outro país) esconde-o. O servidor guarda sempre o formato internacional.
export function PhoneField({ label, hint, error, value, onChange, required }: { label: string; hint?: ReactNode; error?: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  const foreign = /^\s*(\+|00)/.test(value)
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <span className="relative block">
        {!foreign && <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-ink-3" aria-hidden="true">+244</span>}
        <input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="923 456 789" value={value} onChange={(e) => onChange(e.target.value)} required={required}
          aria-invalid={!!error} className={`h-12 md:h-11 ${inputClass} ${foreign ? '' : 'pl-16!'}`} />
      </span>
    </FieldShell>
  )
}

export function TextArea({ label, hint, error, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode; error?: string }) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <textarea {...rest} aria-invalid={!!error} className={`min-h-24 py-3 ${inputClass}`} />
    </FieldShell>
  )
}

export function Select({ label, hint, error, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: ReactNode; error?: string }) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <select {...rest} aria-invalid={!!error} className={`h-12 md:h-11 ${inputClass}`}>{children}</select>
    </FieldShell>
  )
}

// Interruptor com o texto ao lado: o estado vai em texto e na posição, não só na cor.
export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-start justify-between gap-4 border-b border-line py-4 last:border-b-0 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-ink-2">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true" className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-leaf peer-focus-visible:outline-3 peer-focus-visible:outline-coral after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  )
}

// full: no telemóvel ocupa a largura toda, com as opções repartidas. Se não couberem, desliza na horizontal em vez de alargar a página.
export function Segmented<T extends string>({ value, onChange, options, dark = false, full = false }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; dark?: boolean; full?: boolean }) {
  return (
    <div role="tablist" className={`max-w-full overflow-x-auto rounded-xl p-1 [scrollbar-width:none] ${full ? 'flex w-full sm:inline-flex sm:w-auto' : 'inline-flex'} ${dark ? 'bg-white/10' : 'bg-wash'}`}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`h-9 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors sm:px-3.5 ${full ? 'flex-1 sm:flex-none' : ''} ${value === o.value ? (dark ? 'bg-cream text-ink' : 'bg-paper shadow-sm') : dark ? 'text-cream/75 hover:text-cream' : 'text-ink-2'}`}>
          {o.label}{o.count !== undefined && <span className="ml-1.5 opacity-60">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export const ErrorText = ({ error }: { error: unknown }) =>
  error ? <p role="alert" className="mb-3 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{(error as Error).message}</p> : null

// Barra de espaço ocupado: o valor vai também em texto.
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, max ? (value / max) * 100 : 0)
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm"><span className="font-semibold">{label}</span><span className="tabular-nums text-ink-2">{Math.round(pct)}%</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-wash" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full ${pct > 90 ? 'bg-coral' : 'bg-leaf'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/* ───────── Diálogos ───────── */

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = overflow }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 animate-fade bg-ink/55" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`relative max-h-[92dvh] w-full animate-rise overflow-y-auto rounded-t-3xl bg-paper p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink md:rounded-3xl md:p-7 ${wide ? 'md:max-w-2xl' : 'md:max-w-md'}`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-wash"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export { Drawer } from './drawer'
