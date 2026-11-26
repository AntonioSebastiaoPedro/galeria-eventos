// Prepara as fotografias no telemóvel antes de as enviar.
// - HEIC/HEIF (iPhone) e outros formatos que o servidor não lê são convertidos para JPEG.
// - Fotografias acima do limite são reduzidas (poupa dados móveis).
// Ao desenhar no canvas a rotação da câmara fica aplicada e os metadados (GPS) perdem-se.
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

async function toJpeg(file: File, max: number, quality: number): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
  if (!blob) throw new Error('Não foi possível preparar a fotografia.')
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}

export async function preparePhoto(file: File, maxBytes: number): Promise<File> {
  if (ACCEPTED.includes(file.type) && file.size <= maxBytes) return file
  try {
    let out = await toJpeg(file, 6000, 0.92)
    if (out.size > maxBytes) out = await toJpeg(file, 4000, 0.85)
    return out
  } catch {
    if (!ACCEPTED.includes(file.type)) throw new Error('Este formato de fotografia não é suportado neste navegador.')
    return file // o servidor valida
  }
}

export const isVideo = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|webm|3gp|m4v)$/i.test(f.name)
export const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)
