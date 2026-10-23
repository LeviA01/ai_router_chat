import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from './store'
import Login from './pages/Login'
import Register from './pages/Register'
import Chat from './pages/Chat'

const AUTH_PAGES = ['/login', '/register']

export default function App() {
  const { authChecked, user, init } = useApp()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    init()
  }, [init])

  // Редиректим на /login только если пользователь не авторизован
  // и при этом НЕ находится на странице логина/регистрации.
  useEffect(() => {
    if (!authChecked || user) return
    if (AUTH_PAGES.includes(location.pathname)) return
    navigate('/login', { replace: true })
  }, [authChecked, user, location.pathname, navigate])

  if (!authChecked) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-zinc-400">Загрузка...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/chat" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/chat" replace /> : <Register />} />
      <Route path="/chat" element={user ? <Chat /> : <Navigate to="/login" replace />} />
      <Route path="/" element={<Navigate to="/chat" replace />} />
    </Routes>
  )
}
