import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store'
import { ApiError } from '../api'

export default function Register() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useApp()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(email, password, name)
      navigate('/chat')
    } catch (err: any) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Ошибка подключения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-[#05070C] px-4">
      <div className="w-full max-w-sm space-y-6 rounded-3xl bg-[#0F131C] p-8 shadow-2xl shadow-black/50">
        <div className="text-center">
          <h1 className="text-[clamp(1.75rem,3vw,2.25rem)] font-bold tracking-tight text-zinc-50">
            Регистрация
          </h1>
          <p className="mt-2 text-sm text-zinc-400">Создайте новый аккаунт</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800/30 bg-red-950/20 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-300">
              Имя
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-xl border-0 bg-[#161D2B] px-4 py-2.5 text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-inset ring-zinc-700 transition focus:ring-2 focus:ring-indigo-500"
              placeholder="Иван"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-xl border-0 bg-[#161D2B] px-4 py-2.5 text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-inset ring-zinc-700 transition focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-xl border-0 bg-[#161D2B] px-4 py-2.5 text-zinc-100 placeholder-zinc-500 outline-none ring-1 ring-inset ring-zinc-700 transition focus:ring-2 focus:ring-indigo-500"
              placeholder="Минимум 6 символов"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-indigo-600 px-4 py-2.5 font-semibold text-zinc-50 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Создание...' : 'Создать аккаунт'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-400">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}
