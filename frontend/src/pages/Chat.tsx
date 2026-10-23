import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import ProvidersModal from '../components/ProvidersModal'
import ReactMarkdown from 'react-markdown'
import {
  Send,
  Plus,
  Trash2,
  Settings2,
  LogOut,
  Sparkles,
  Bot,
  User,
  Square,
  Cpu,
} from 'lucide-react'

export default function ChatPage() {
  const {
    user,
    providers,
    chats,
    activeChatId,
    messages,
    streaming,
    error,
    logout,
    newChat,
    selectChat,
    removeChat,
    updateChatSettings,
    send,
    stop,
  } = useApp()

  const [input, setInput] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeChat = chats.find((c) => c.id === activeChatId)
  const activeProvider = providers.find((p) => p.id === activeChat?.provider_id)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (chats.length > 0 && !activeChatId) {
      selectChat(chats[0].id)
    }
  }, [chats, activeChatId, selectChat])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || streaming) return
    const text = input
    setInput('')
    await send(text)
  }

  const handleNewChat = async () => {
    const p = providers[0]
    const m = p?.models?.[0] || ''
    await newChat(p?.id, m)
  }

  const handleProviderChange = async (providerId: string) => {
    if (!activeChatId) return
    const p = providers.find((prov) => prov.id === providerId)
    const newModel = p?.models?.[0] || ''
    await updateChatSettings(activeChatId, providerId, newModel)
  }

  const handleModelChange = async (model: string) => {
    if (!activeChatId || !activeChat) return
    await updateChatSettings(activeChatId, activeChat.provider_id, model)
  }

  return (
    <div className="flex h-full bg-[#05070C]">
      {/* Sidebar */}
      <aside className="flex w-72 flex-col border-r border-zinc-800/80 bg-[#0A0D14]">
        <div className="flex items-center justify-between border-b border-zinc-800/80 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            <span className="font-bold text-zinc-100">AI Chat</span>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            title="Настройки провайдеров"
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600/90 py-2.5 text-sm font-semibold text-zinc-50 transition hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" /> Новый чат
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {chats.map((c) => {
            const active = c.id === activeChatId
            return (
              <div
                key={c.id}
                onClick={() => selectChat(c.id)}
                className={`group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-[#161D2B] text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                }`}
              >
                <span className="truncate">{c.title || 'Чат без названия'}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeChat(c.id)
                  }}
                  className="hidden rounded-full p-1 text-zinc-500 hover:text-red-400 group-hover:block"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        {/* User bar */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 p-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-300">
              {user?.name?.[0] || user?.email?.[0] || 'U'}
            </div>
            <div className="truncate text-xs">
              <div className="font-medium text-zinc-200 truncate">{user?.name || 'Пользователь'}</div>
              <div className="text-zinc-500 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            title="Выйти"
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main chat */}
      <main className="flex flex-1 flex-col">
        {/* Header: Provider & Model Selector */}
        <header className="flex items-center justify-between border-b border-zinc-800/80 bg-[#0A0D14]/50 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-indigo-400" />
            <div className="flex items-center gap-2">
              {/* Провайдер */}
              <select
                value={activeChat?.provider_id || ''}
                onChange={(e) => handleProviderChange(e.target.value)}
                disabled={providers.length === 0}
                className="rounded-xl bg-[#161D2B] px-3 py-1.5 text-sm font-medium text-zinc-200 ring-1 ring-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {providers.length === 0 && <option value="">Добавьте провайдера</option>}
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Модель */}
              <select
                value={activeChat?.model || ''}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={!activeProvider || !activeProvider.models?.length}
                className="max-w-[280px] truncate rounded-xl bg-[#161D2B] px-3 py-1.5 text-sm font-medium text-zinc-200 ring-1 ring-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {!activeProvider?.models?.length ? (
                  <option value="">Нет моделей (обновите провайдер)</option>
                ) : (
                  activeProvider.models.map((m: string) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="text-xs text-zinc-500">
            {activeChat?.model ? (
              <span className="rounded-full bg-zinc-800/70 px-3 py-1 font-mono text-[11px] text-zinc-300">
                {activeChat.model}
              </span>
            ) : null}
          </div>
        </header>

        {/* Message container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {providers.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Cpu className="h-12 w-12 text-zinc-600 mb-3" />
              <h3 className="text-lg font-semibold text-zinc-200">Нет подключенных провайдеров</h3>
              <p className="mt-1 max-w-sm text-sm text-zinc-400">
                Чтобы начать общение, добавьте провайдера (например OpenRouter) и введите свой API-ключ.
              </p>
              <button
                onClick={() => setModalOpen(true)}
                className="mt-4 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-zinc-50 hover:bg-indigo-500"
              >
                Добавить провайдера
              </button>
            </div>
          ) : !activeChatId ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Sparkles className="h-12 w-12 text-zinc-600 mb-3" />
              <h3 className="text-lg font-semibold text-zinc-200">Выберите или создайте чат</h3>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Bot className="h-12 w-12 text-zinc-600 mb-3" />
              <h3 className="text-lg font-semibold text-zinc-200">Чат готов к общению</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Модель: <span className="font-mono text-indigo-400">{activeChat?.model || 'не выбрана'}</span>
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === 'user'
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 max-w-3xl ${
                    isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isUser
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700'
                    }`}
                  >
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  <div
                    className={`rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#10141F] text-zinc-100 ring-1 ring-zinc-800'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    ) : (
                      <div className="markdown">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {error && (
            <div className="mx-auto max-w-xl rounded-xl border border-red-800/30 bg-red-950/20 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <div className="border-t border-zinc-800/80 bg-[#0A0D14]/80 p-4">
          <form onSubmit={handleSend} className="mx-auto flex max-w-3xl items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                !activeChat?.model
                  ? 'Сначала выберите модель сверху...'
                  : 'Спросите что-нибудь у нейросети...'
              }
              disabled={!activeChat?.model || streaming}
              className="flex-1 rounded-full bg-[#161D2B] px-5 py-3 text-sm text-zinc-100 placeholder-zinc-500 ring-1 ring-zinc-700 outline-none transition focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-500"
              >
                <Square className="h-4 w-4 fill-white" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || !activeChat?.model}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>
      </main>

      <ProvidersModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
