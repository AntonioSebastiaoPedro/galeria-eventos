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

const A4 = { w: 595, h: 842 } // pontos PDF

// PDF mínimo em A4, uma imagem JPEG por página: dispensa uma biblioteca só para isto.
// `fit` encaixa a imagem na página com margem; `full` ocupa a página inteira (folhas já desenhadas à escala A4).
function pdfWithJpegs(pages: { jpeg: Uint8Array; w: number; h: number }[], mode: 'fit' | 'full'): Blob {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (p: Uint8Array | string) => { const b = typeof p === 'string' ? enc.encode(p) : p; parts.push(b); length += b.length }
  const obj = (n: number, body: (string | Uint8Array)[]) => {
    offsets[n] = length
    push(`${n} 0 obj\n`)
    body.forEach(push)
    push('\nendobj\n')
  }

  // Objectos: 1 catálogo, 2 páginas, e para cada página i: página, imagem e conteúdo.
  const pageObj = (i: number) => 3 + i * 3
  push('%PDF-1.4\n')
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>'])
  obj(2, [`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`])
  pages.forEach((pg, i) => {
    const n = pageObj(i)
    let { w, h } = A4
    let x = 0
    let y = 0
    if (mode === 'fit') {
      h = A4.h - 80
      w = (h * pg.w) / pg.h
      x = (A4.w - w) / 2
      y = 40
    }
    const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`
    obj(n, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /XObject << /Im0 ${n + 1} 0 R >> >> /Contents ${n + 2} 0 R >>`])
    obj(n + 1, [`<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`, pg.jpeg, '\nendstream'])
    obj(n + 2, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`])
  })

  const total = 3 + pages.length * 3
  const xref = length
  push(`xref\n0 ${total}\n0000000000 65535 f \n`)
  for (let n = 1; n < total; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)
  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}

const jpegOf = async (canvas: HTMLCanvasElement) => ({
  jpeg: new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer()),
  w: canvas.width,
  h: canvas.height,
})

const fileBase = (card: Card) => `qr-${card.title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '') || 'galeria'}`

export async function downloadCardPng(card: Card) {
  saveBlob(await toBlob(await draw(card), 'image/png'), `${fileBase(card)}.png`)
}

export async function downloadCardPdf(card: Card) {
  saveBlob(pdfWithJpegs([await jpegOf(await draw(card))], 'fit'), `${fileBase(card)}.pdf`)
}

// Folhas A4 com 9 cartões (3 × 3) para imprimir, cortar e pôr nas mesas.
// Cada cartão fica com cerca de 6,3 × 9 cm; o QR, com uns 4 cm, lê-se bem a um braço de distância.
export const PER_SHEET = 9
export const MAX_CARDS = 180

export async function downloadSheetsPdf(card: Card, count: number) {
  const total = Math.min(MAX_CARDS, Math.max(1, Math.floor(count)))
  const single = await draw(card)
  const pageW = 1654 // A4 a 200 ppp
  const pageH = 2339
  const margin = 79 // 1 cm: as impressoras não imprimem até à borda
  const cellW = (pageW - margin * 2) / 3
  const cellH = (cellW * H) / W
  const top = (pageH - cellH * 3) / 2

  const pages = []
  for (let first = 0; first < total; first += PER_SHEET) {
    const onPage = Math.min(PER_SHEET, total - first)
    const canvas = document.createElement('canvas')
    canvas.width = pageW
    canvas.height = pageH
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pageW, pageH)
    ctx.imageSmoothingQuality = 'high'
    for (let i = 0; i < onPage; i++) {
      ctx.drawImage(single, margin + (i % 3) * cellW, top + Math.floor(i / 3) * cellH, cellW, cellH)
    }
    // Linhas de corte tracejadas à volta dos cartões desta folha.
    const rows = Math.ceil(onPage / 3)
    ctx.strokeStyle = '#9a9088'
    ctx.lineWidth = 2
    ctx.setLineDash([14, 10])
    for (let i = 0; i < onPage; i++) {
      ctx.strokeRect(margin + (i % 3) * cellW, top + Math.floor(i / 3) * cellH, cellW, cellH)
    }
    ctx.setLineDash([])
    ctx.fillStyle = '#9a9088'
    ctx.font = '400 22px "Schibsted Grotesk Variable", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`✂  Corte pelas linhas tracejadas · folha ${first / PER_SHEET + 1} de ${Math.ceil(total / PER_SHEET)}`, pageW / 2, top + rows * cellH + 44)
    pages.push(await jpegOf(canvas))
  }
  saveBlob(pdfWithJpegs(pages, 'full'), `${fileBase(card)}-${total}-cartoes.pdf`)
}
