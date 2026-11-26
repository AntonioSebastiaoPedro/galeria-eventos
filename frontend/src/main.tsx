import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from './api'
import { notifyError, Toaster } from './toast'
import { AuthProvider } from './auth'
import App from './App'
import './index.css'

// Qualquer formulário que falhe mostra o aviso e leva a página ao campo com erro.
// A sessão terminada (401) tem o seu próprio tratamento.
const queryClient = new QueryClient({
  mutationCache: new MutationCache({ onError: (e) => { if (!(e instanceof ApiError && e.status === 401)) notifyError(e) } }),
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
