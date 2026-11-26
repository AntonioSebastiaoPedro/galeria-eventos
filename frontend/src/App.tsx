import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { Layout, Spinner } from './components'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Account from './pages/Account'
import Events from './pages/organizer/Events'
import NewEvent from './pages/organizer/NewEvent'
import EventShell from './pages/organizer/EventShell'
import EventOverview from './pages/organizer/EventOverview'
import EventMediaPage from './pages/organizer/EventMedia'
import EventGuests from './pages/organizer/EventGuests'
import EventSettings from './pages/organizer/EventSettings'
import Admin from './pages/admin/Admin'
import Gallery from './pages/gallery/Gallery'

function Protected({ admin = false }: { admin?: boolean }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-6"><Spinner /></div>
  if (!user) return <Navigate to="/entrar" replace />
  if (admin && user.role !== 'superadmin') return <Navigate to="/eventos" replace />
  return <Layout />
}

// Quem já tem sessão não precisa das páginas de entrada.
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/eventos" replace /> : children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/g/:slug" element={<Gallery />} />
      <Route path="/entrar" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/criar-conta" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/recuperar-senha" element={<ForgotPassword />} />
      <Route path="/definir-senha" element={<ResetPassword />} />
      <Route element={<Protected />}>
        <Route path="/eventos" element={<Events />} />
        <Route path="/eventos/novo" element={<NewEvent />} />
        <Route path="/eventos/:id" element={<EventShell />}>
          <Route index element={<EventOverview />} />
          <Route path="conteudos" element={<EventMediaPage />} />
          <Route path="convidados" element={<EventGuests />} />
          <Route path="definicoes" element={<EventSettings />} />
        </Route>
        <Route path="/conta" element={<Account />} />
      </Route>
      <Route element={<Protected admin />}>
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
