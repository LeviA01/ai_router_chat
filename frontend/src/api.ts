export interface User {
  id: string
  email: string
  name: string
  created_at: string
}

export interface Provider {
  id: string
  name: string
  base_url: string
  kind: string
  models: string[]
  has_key: boolean
  created_at: string
}

export interface Chat {
  id: string
  title: string
  provider_id: string
  model: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  chat_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

const TOKEN_KEY = 'ai_chat_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(path, { ...options, headers })
  if (res.status === 204) return undefined as T

  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!res.ok) {
    const msg = data?.error || `Ошибка ${res.status}`
    throw new ApiError(res.status, msg)
  }
  return data as T
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<User>('/api/me'),

  listProviders: () => request<Provider[]>('/api/providers'),

  createProvider: (data: { name: string; base_url: string; api_key: string; kind?: string }) =>
    request<Provider>('/api/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProvider: (
    id: string,
    data: { name?: string; base_url?: string; api_key?: string; kind?: string },
  ) =>
    request<Provider>(`/api/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteProvider: (id: string) =>
    request<void>(`/api/providers/${id}`, { method: 'DELETE' }),

  refreshModels: (id: string) =>
    request<Provider>(`/api/providers/${id}/models/refresh`, { method: 'POST' }),

  listChats: () => request<Chat[]>('/api/chats'),

  createChat: (data: { title?: string; provider_id?: string; model?: string }) =>
    request<Chat>('/api/chats', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateChat: (id: string, data: { title?: string; provider_id?: string; model?: string }) =>
    request<Chat>(`/api/chats/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteChat: (id: string) => request<void>(`/api/chats/${id}`, { method: 'DELETE' }),

  listMessages: (chatId: string) => request<Message[]>(`/api/chats/${chatId}/messages`),

  sendMessage: (chatId: string, content: string) =>
    request<void>(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
}

export interface StreamHandlers {
  onUserMessage?: (msg: Message) => void
  onToken: (token: string) => void
  onDone?: () => void
  onError: (message: string) => void
}

export async function streamMessage(
  chatId: string,
  content: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const token = getToken()
  const res = await fetch(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    let msg = `Ошибка ${res.status}`
    try {
      msg = JSON.parse(text).error || msg
    } catch {
      /* ignore */
    }
    handlers.onError(msg)
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    handlers.onError('Нет потока данных')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  const dispatch = (block: string) => {
    let event = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    const data = dataLines.join('\n')
    if (!data) return

    if (event === 'token') {
      try {
        handlers.onToken(JSON.parse(data))
      } catch {
        handlers.onToken(data)
      }
    } else if (event === 'message') {
      try {
        handlers.onUserMessage?.(JSON.parse(data))
      } catch {
        /* ignore */
      }
    } else if (event === 'error') {
      handlers.onError(data)
    } else if (event === 'done') {
      handlers.onDone?.()
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) dispatch(part)
  }
  if (buffer.trim()) dispatch(buffer)
  handlers.onDone?.()
}
