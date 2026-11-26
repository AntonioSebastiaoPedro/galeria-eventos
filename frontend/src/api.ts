// Cliente da API: sessão por cookie (Sanctum) com proteção CSRF. Os convidados também têm sessão (sem conta).
function xsrf(): string {
  const m = document.cookie.match(/XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

// Avisado quando um pedido autenticado devolve 401/419: a sessão terminou e a aplicação deve ir para o login.
export const SESSION_EXPIRED = 'session-expired'

async function net<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (e) {
    if (e instanceof TypeError) throw new ApiError(0, 'Sem ligação à internet.')
    throw e
  }
}

async function ensureCsrf() {
  if (!xsrf()) await net(() => fetch('/sanctum/csrf-cookie', { credentials: 'include' }))
}

function toError(status: number, data: { message?: string; errors?: Record<string, string[]> } | null, retryAfter?: string | null): ApiError {
  // O Laravel responde "Too Many Attempts." em inglês: traduz e diz quanto esperar.
  if (status === 429) {
    const wait = Number(retryAfter)
    if (data?.message && !/too many/i.test(data.message)) return new ApiError(429, data.message)
    return new ApiError(429, `Demasiadas tentativas.${wait ? ` Aguarde ${wait >= 90 ? `${Math.ceil(wait / 60)} minutos` : `${wait} segundos`} e tente outra vez.` : ' Aguarde um pouco e tente outra vez.'}`)
  }
  if (status === 413) return new ApiError(413, 'O ficheiro é demasiado grande para enviar.')
  const fallback = status === 403 ? 'Não tem permissão para esta ação.' : status === 404 ? 'Não encontrado.' : 'Ocorreu um erro.'
  return new ApiError(status, data?.message || fallback, data?.errors)
}

const AUTH_PATHS = ['/login', '/me', '/register']

export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (method !== 'GET') await ensureCsrf()

  const isForm = body instanceof FormData
  const res = await net(() => fetch('/api' + path, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'X-XSRF-TOKEN': xsrf(),
      ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  }))

  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    if ((res.status === 401 || res.status === 419) && !AUTH_PATHS.includes(path)) window.dispatchEvent(new Event(SESSION_EXPIRED))
    throw toError(res.status, data, res.headers.get('Retry-After'))
  }
  return data as T
}

// Envio com progresso (o fetch não o dá). Pode ser cancelado com o AbortSignal.
export async function upload<T = unknown>(path: string, form: FormData, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<T> {
  await ensureCsrf()
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api' + path)
    xhr.withCredentials = true
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.setRequestHeader('X-XSRF-TOKEN', xsrf())
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total) }
    xhr.onload = () => {
      let data = null
      try { data = JSON.parse(xhr.responseText) } catch { /* resposta sem JSON (ex.: 413 do nginx) */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T)
      else reject(toError(xhr.status, data, xhr.getResponseHeader('Retry-After')))
    }
    xhr.onerror = () => reject(new ApiError(0, 'Sem ligação à internet.'))
    xhr.onabort = () => reject(new ApiError(-1, 'Envio cancelado.'))
    signal?.addEventListener('abort', () => xhr.abort())
    xhr.send(form)
  })
}
