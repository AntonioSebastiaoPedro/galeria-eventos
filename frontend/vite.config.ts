import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Em desenvolvimento, a API e os cookies passam pelo nginx do Docker (mesma origem, sem CORS).
const target = process.env.API_PROXY ?? 'http://nginx:80'
// '/app' é o WebSocket do Reverb (o nginx encaminha-o); sem ws:true o tempo real não passa pelo Vite.
const proxy = { '/api': target, '/sanctum': target, '/broadcasting': target, '/app': { target, ws: true } }

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Galeria de Eventos',
        short_name: 'Galeria',
        description: 'Álbum colaborativo de eventos: fotografias e vídeos de todos os convidados num só lugar.',
        lang: 'pt-AO',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f5efe6',
        theme_color: '#1f1a16',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Guarda só a aplicação (HTML, JS, CSS, fontes). A API e as fotografias nunca passam pela cache do
        // Service Worker: as URLs dos ficheiros são assinadas e temporárias.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/sanctum/, /^\/broadcasting/, /^\/app\//, /^\/telescope/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { proxy },
  preview: { proxy, host: true },
})
