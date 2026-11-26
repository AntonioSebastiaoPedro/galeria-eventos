// Cartão para imprimir com o QR Code da galeria (mesas, entrada, convites), em PNG ou PDF.
// Tudo é desenhado no navegador a partir do QR já carregado; nada é enviado ao servidor.
import { EVENT_TYPES, fmtLongDate } from './format'

interface Card { title: string; event_type: string; event_date: string; qr_png: string; url: string }

const W = 1200
const H = 1700

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível preparar o QR Code.'))
    img.src = src
  })
}

// Escreve o texto em até três linhas, reduzindo o tamanho se ainda assim não couber.
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: (size: number) => string, from: number, to: number) {
  for (let size = from; size >= to; size -= 4) {
    ctx.font = font(size)
    const lines: string[] = []
    let line = ''
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width <= maxWidth || !line) line = next
      else { lines.push(line); line = word }
    }
    lines.push(line)
    if (lines.length <= 3 && lines.every((l) => ctx.measureText(l).width <= maxWidth)) return { lines, size }
  }
  return { lines: [text], size: to }
}

async function draw(card: Card): Promise<HTMLCanvasElement> {
  await document.fonts.ready
  const qr = await loadImage(card.qr_png)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#f5efe6'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#d9472b'
  ctx.fillRect(0, 0, W, 24)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#d9472b'
  ctx.font = '600 38px "Schibsted Grotesk Variable", sans-serif'
  ctx.fillText(`${EVENT_TYPES[card.event_type] ?? 'Evento'} · ${fmtLongDate(card.event_date)}`.toUpperCase(), W / 2, 150)

  ctx.fillStyle = '#1f1a16'
  const display = (s: number) => `600 ${s}px "Fraunces Variable", Georgia, serif`
  const { lines, size } = fit(ctx, card.title, W - 200, display, 96, 56)
  ctx.font = display(size)
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 260 + i * (size * 1.1)))
  const afterTitle = 260 + (lines.length - 1) * size * 1.1

  const qrSize = 760
  const qrY = afterTitle + 90
  ctx.fillStyle = '#ffffff'
  ctx.fillRect((W - qrSize) / 2 - 30, qrY - 30, qrSize + 60, qrSize + 60)
  ctx.imageSmoothingEnabled = false // módulos do QR com arestas nítidas
  ctx.drawImage(qr, (W - qrSize) / 2, qrY, qrSize, qrSize)
  ctx.imageSmoothingEnabled = true

  ctx.fillStyle = '#1f1a16'
  ctx.font = '700 54px "Schibsted Grotesk Variable", sans-serif'
  ctx.fillText('Partilhe as suas fotografias e vídeos', W / 2, qrY + qrSize + 140)
  ctx.fillStyle = '#4a423b'
  ctx.font = '400 38px "Schibsted Grotesk Variable", sans-serif'
  ctx.fillText('Aponte a câmara do telemóvel para o código.', W / 2, qrY + qrSize + 200)
  ctx.fillText('Não precisa de instalar nada.', W / 2, qrY + qrSize + 250)
  return canvas
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível criar o ficheiro.'))), type, quality))

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// PDF mínimo (A4, uma página) com o cartão como JPEG: dispensa uma biblioteca só para isto.
function pdfWithJpeg(jpeg: Uint8Array, px: { w: number; h: number }): Blob {
  const pageW = 595
  const pageH = 842
  const h = pageH - 80
  const w = (h * px.w) / px.h
  const x = (pageW - w) / 2
  const y = 40
  const content = `q ${w.toFixed(2)} 0 0 ${h} ${x.toFixed(2)} ${y} cm /Im0 Do Q`

  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (p: Uint8Array | string) => { const b = typeof p === 'string' ? enc.encode(p) : p; parts.push(b); length += b.length }
  const obj = (n: number, body: string | Uint8Array[]) => {
    offsets[n] = length
    push(`${n} 0 obj\n`)
    if (typeof body === 'string') push(body)
    else body.forEach(push)
    push('\nendobj\n')
  }

  push('%PDF-1.4\n')
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`)
  obj(4, [`<< /Type /XObject /Subtype /Image /Width ${px.w} /Height ${px.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream'].map((p) => (typeof p === 'string' ? enc.encode(p) : p)))
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)

  const xref = length
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => `${String(offsets[n]).padStart(10, '0')} 00000 n \n`).join('')}`)
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)
  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}

const fileBase = (card: Card) => `qr-${card.title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '') || 'galeria'}`

export async function downloadCardPng(card: Card) {
  saveBlob(await toBlob(await draw(card), 'image/png'), `${fileBase(card)}.png`)
}

export async function downloadCardPdf(card: Card) {
  const canvas = await draw(card)
  const jpeg = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.95)).arrayBuffer())
  saveBlob(pdfWithJpeg(jpeg, { w: canvas.width, h: canvas.height }), `${fileBase(card)}.pdf`)
}
