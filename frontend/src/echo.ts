import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

;(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher

let instance: Echo<'reverb'> | null = null

// Liga ao Reverb pelo mesmo host do nginx (caminho /app), só quando é preciso (área do organizador).
export function echo(): Echo<'reverb'> {
  instance ??= new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY ?? 'galeria-key',
    wsHost: location.hostname,
    wsPort: Number(location.port || (location.protocol === 'https:' ? 443 : 80)),
    wssPort: Number(location.port || 443),
    forceTLS: location.protocol === 'https:',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: '/broadcasting/auth',
    auth: {
      headers: {
        get 'X-XSRF-TOKEN'() {
          return decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '')
        },
      },
    },
  })
  return instance
}
