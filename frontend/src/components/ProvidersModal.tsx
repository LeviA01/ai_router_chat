import { useState } from 'react'
import { useApp } from '../store'
import { Plus, RefreshCw, Trash2, X, KeyRound, Globe } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function ProvidersModal({ isOpen, onClose }: Props) {
  const { providers, addProvider, removeProvider, refreshModels } = useApp()
  const [name, setName] = useState('OpenRouter')
  const [baseUrl, setBaseUrl] = useState('https://openrouter.ai/api/v1')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await addProvider(name, baseUrl, apiKey, 'openai_compatible')
      setApiKey('')
    } catch (err: any) {
      setError(err?.message || 'Ошибка добавления')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async (id: string) => {
    setRefreshingId(id)
    try {
      await refreshModels(id)
    } catch (err: any) {
      alert('Ошибка обновления моделей: ' + (err?.message || ''))
    } finally {
      setRefreshingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-[#0F131C] shadow-2xl ring-1 ring-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 p-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Провайдеры нейросетей</h2>
            <p className="text-sm text-zinc-400">OpenRouter, DeepSeek, OpenAI и совместимые</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-xl border border-red-800/30 bg-red-950/20 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleAdd} className="space-y-3 rounded-2xl bg-[#161D2B] p-4 ring-1 ring-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-200">Добавить нового провайдера</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-zinc-400">Название</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="OpenRouter"
                  className="mt-1 w-full rounded-xl bg-[#0B0F17] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Base URL</label>
                <input
                  type="text"
                  required
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://openrouter.ai/api/v1"
                  className="mt-1 w-full rounded-xl bg-[#0B0F17] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400">API Key</label>
              <input
                type="password"
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="mt-1 w-full rounded-xl bg-[#0B0F17] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-zinc-50 transition hover:bg-indigo-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {loading ? 'Добавление...' : 'Добавить'}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-300">Сохранённые провайдеры</h3>
            {providers.length === 0 ? (
              <p className="text-sm text-zinc-500">Провайдеров пока нет. Добавьте первый выше.</p>
            ) : (
              providers.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-3 rounded-2xl bg-[#161D2B] p-4 ring-1 ring-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-zinc-100">{p.name}</div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                        <Globe className="h-3 w-3" />
                        <span>{p.base_url}</span>
                        <span className="text-zinc-600">•</span>
                        <KeyRound className="h-3 w-3" />
                        <span>{p.has_key ? 'Ключ задан' : 'Нет ключа'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRefresh(p.id)}
                        disabled={refreshingId === p.id}
                        title="Обновить список моделей"
                        className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshingId === p.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => removeProvider(p.id)}
                        title="Удалить"
                        className="rounded-full p-2 text-zinc-400 hover:bg-red-950/40 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800/60 pt-3">
                    <div className="text-xs text-zinc-400 mb-1">
                      Доступно моделей: {p.models?.length || 0}
                    </div>
                    {p.models && p.models.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {p.models.slice(0, 10).map((m: string) => (
                          <span
                            key={m}
                            className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 font-mono"
                          >
                            {m}
                          </span>
                        ))}
                        {p.models.length > 10 && (
                          <span className="text-xs text-zinc-500 self-center">
                            +{p.models.length - 10} ещё
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">
                        Модели не загружены. Нажмите кнопку обновления рядом.
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
