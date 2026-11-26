import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// Vai para o <body>: dentro do cabeçalho (backdrop-blur) um elemento fixed ficaria preso à altura dele.
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title}
        className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-paper p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[30rem] md:rounded-none md:rounded-l-3xl md:p-8">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line md:hidden" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="flex size-11 items-center justify-center rounded-full hover:bg-wash md:size-10"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
