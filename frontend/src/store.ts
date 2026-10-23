import { create } from 'zustand'
import {
  api,
  clearToken,
  getToken,
  setToken,
  streamMessage,
  type Chat,
  type Message,
  type Provider,
  type User,
} from './api'

interface AppState {
  user: User | null
  authChecked: boolean
  providers: Provider[]
  chats: Chat[]
  activeChatId: string | null
  messages: Message[]
  streaming: boolean
  error: string | null

  init: () => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => void

  loadProviders: () => Promise<void>
  addProvider: (name: string, baseUrl: string, apiKey: string, kind: string) => Promise<void>
  removeProvider: (id: string) => Promise<void>
  refreshModels: (id: string) => Promise<void>

  loadChats: () => Promise<void>
  newChat: (providerId?: string, model?: string) => Promise<string | null>
  selectChat: (id: string) => Promise<void>
  removeChat: (id: string) => Promise<void>
  updateChatSettings: (id: string, providerId: string, model: string) => Promise<void>

  send: (content: string) => Promise<void>
  stop: () => void
}

let abortController: AbortController | null = null

export const useApp = create<AppState>((set, get) => ({
  user: null,
  authChecked: false,
  providers: [],
  chats: [],
  activeChatId: null,
  messages: [],
  streaming: false,
  error: null,

  init: async () => {
    if (!getToken()) {
      set({ authChecked: true })
      return
    }
    try {
      const user = await api.me()
      set({ user, authChecked: true })
      // Загружаем провайдеров и чаты, но если эти запросы упадут — 
      // это не повод логаут. Пользователь авторизован.
      try {
        await Promise.all([get().loadProviders(), get().loadChats()])
      } catch (err) {
        console.error('Failed to load providers/chats:', err)
      }
    } catch {
      // Токен невалидный или /api/me упал — разлогин.
      clearToken()
      set({ user: null, authChecked: true })
    }
  },

  register: async (email, password, name) => {
    const res = await api.register(email, password, name)
    setToken(res.token)
    set({ user: res.user })
    await Promise.all([get().loadProviders(), get().loadChats()])
  },

  login: async (email, password) => {
    const res = await api.login(email, password)
    setToken(res.token)
    set({ user: res.user })
    await Promise.all([get().loadProviders(), get().loadChats()])
  },

  logout: () => {
    clearToken()
    abortController?.abort()
    set({ user: null, providers: [], chats: [], activeChatId: null, messages: [] })
  },

  loadProviders: async () => {
    const providers = await api.listProviders()
    set({ providers })
  },

  addProvider: async (name, baseUrl, apiKey, kind) => {
    await api.createProvider({ name, base_url: baseUrl, api_key: apiKey, kind })
    await get().loadProviders()
  },

  removeProvider: async (id) => {
    await api.deleteProvider(id)
    await get().loadProviders()
  },

  refreshModels: async (id) => {
    const updated = await api.refreshModels(id)
    set({ providers: get().providers.map((p) => (p.id === updated.id ? updated : p)) })
  },

  loadChats: async () => {
    const chats = await api.listChats()
    set({ chats })
  },

  newChat: async (providerId, model) => {
    const chat = await api.createChat({
      title: 'New chat',
      provider_id: providerId ?? get().providers[0]?.id ?? '',
      model: model ?? '',
    })
    set({ chats: [chat, ...get().chats], activeChatId: chat.id, messages: [] })
    return chat.id
  },

  selectChat: async (id) => {
    set({ activeChatId: id, messages: [] })
    const messages = await api.listMessages(id)
    set({ messages })
  },

  removeChat: async (id) => {
    await api.deleteChat(id)
    const chats = get().chats.filter((c) => c.id !== id)
    set({ chats })
    if (get().activeChatId === id) {
      set({ activeChatId: null, messages: [] })
    }
  },

  updateChatSettings: async (id, providerId, model) => {
    await api.updateChat(id, { provider_id: providerId, model })
    await get().loadChats()
  },

  send: async (content) => {
    const chatId = get().activeChatId
    if (!chatId || get().streaming) return

    const userMessage: Message = {
      id: `local-${Date.now()}`,
      chat_id: chatId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    const assistantId = `local-assistant-${Date.now()}`
    set({
      messages: [...get().messages, userMessage, { ...userMessage, id: assistantId, role: 'assistant', content: '' }],
      streaming: true,
      error: null,
    })

    abortController = new AbortController()
    try {
      await streamMessage(
        chatId,
        content,
        {
          onToken: (token: string) => {
            set({
              messages: get().messages.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + token } : m,
              ),
            })
          },
          onError: (message: string) => {
            set({ error: message })
            set({ messages: get().messages.filter((m) => m.id !== assistantId) })
          },
        },
        abortController.signal,
      )
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        set({ error: err?.message || 'Ошибка соединения' })
      }
      set({ messages: get().messages.filter((m) => m.id !== assistantId) })
    } finally {
      abortController = null
      set({ streaming: false })
      get().loadChats()
    }
  },

  stop: () => {
    abortController?.abort()
    abortController = null
    set({ streaming: false })
  },
}))
