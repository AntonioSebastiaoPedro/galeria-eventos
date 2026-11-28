export const EVENT_TYPES: Record<string, string> = {
  birthday: 'Aniversário',
  wedding: 'Casamento',
  baptism: 'Baptizado',
  graduation: 'Formatura',
  corporate: 'Evento empresarial',
  party: 'Festa',
  other: 'Outro',
}

// As datas do evento vêm como AAAA-MM-DD (sem hora): lidas como data local, para não mudarem de dia.
const asDate = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`) : new Date(d))

export const fmtLongDate = (d: string) => asDate(d).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })

export const fmtDateTime = (d: string) => new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const fmtRelative = (d: string) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return 'agora mesmo'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  return fmtDateTime(d)
}

export const fmtSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B`
    : bytes < 1024 ** 2 ? `${Math.round(bytes / 1024)} KB`
      : bytes < 1024 ** 3 ? `${(bytes / 1024 ** 2).toFixed(1).replace('.', ',')} MB`
        : `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`

export const fmtDuration = (s: number | null) => {
  if (!s) return ''
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`
}

export const fmtKz = (n: number) => (n === 0 ? 'Grátis' : `${n.toLocaleString('pt-PT')} Kz`)

export const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-PT')} ${n === 1 ? one : many}`

// Telemóveis: "+244923456789" mostra-se "+244 923 456 789"; um número angolano sem indicativo, "923 456 789".
export const fmtPhone = (p: string | null | undefined) => {
  if (!p) return ''
  const d = p.replace(/[^\d+]/g, '')
  const m = /^(\+244)?(9\d{2})(\d{3})(\d{3})$/.exec(d)
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ') : p
}

// Conversa de WhatsApp com um número (sem número: escolher o contacto na aplicação).
export const whatsappLink = (phone: string | null | undefined, text: string) => {
  let d = (phone ?? '').replace(/\D/g, '')
  if (/^9\d{8}$/.test(d)) d = '244' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`
}

// "+244923456789" → "923 456 789" para editar (o +244 já aparece no campo de telemóvel).
export const phoneForInput = (p: string | null) => (p ? p.replace(/^\+244/, '').replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3') : '')
