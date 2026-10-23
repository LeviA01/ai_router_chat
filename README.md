# AI Chat – приложение для общения с нейросетями

Полнофункциональное веб-приложение для работы с AI провайдерами (OpenRouter, DeepSeek, OpenAI и совместимыми). 

**Backend:** Go + SQLite + JWT  
**Frontend:** React + TypeScript + Tailwind CSS

## Функционал

- 🔐 Регистрация и авторизация
- 🔌 Добавление провайдеров (OpenRouter и совместимые с OpenAI)
- 📚 Загрузка списка доступных моделей
- 💬 Чаты с историей сообщений
- ⚡ Потоковая передача ответов (SSE)
- 🔄 Переключение между моделями внутри чата
- 🎨 Современный интерфейс с поддержкой markdown

## Быстрый старт

### Требования
- Go 1.21+
- Node.js 18+
- npm или yarn

### Запуск бэкенда

```bash
cd backend
go build -o server .
./server
```

Сервер запустится на `http://localhost:8080`

Переменные окружения:
- `PORT` – порт (по умолчанию 8080)
- `DB_PATH` – путь к БД SQLite (по умолчанию chat.db)
- `JWT_SECRET` – секрет для JWT (по умолчанию тестовый, **измените в продакшене**)

### Запуск фронтенда

```bash
cd frontend
npm install
npm run dev
```

Приложение откроется на `http://localhost:5173`

## Использование

1. **Зарегистрируйтесь** или войдите в существующий аккаунт
2. **Добавьте провайдера** (кнопка ⚙️ в левой панели):
   - Название: OpenRouter
   - Base URL: `https://openrouter.ai/api/v1`
   - API Key: ваш ключ от OpenRouter/DeepSeek/другого
3. **Обновите список моделей** (кнопка ↻ рядом с провайдером)
4. **Создайте новый чат** (+ Новый чат)
5. **Выберите провайдера и модель** в шапке окна
6. **Начните писать** – ответы будут приходить потоком

## API

Основные endpoint'ы:

```
POST   /api/auth/register              – Регистрация
POST   /api/auth/login                 – Вход
GET    /api/me                         – Текущий пользователь

GET    /api/providers                  – Список провайдеров
POST   /api/providers                  – Добавить провайдера
PUT    /api/providers/{id}             – Обновить провайдера
DELETE /api/providers/{id}             – Удалить провайдера
POST   /api/providers/{id}/models/refresh – Загрузить модели

GET    /api/chats                      – Список чатов
POST   /api/chats                      – Создать чат
GET    /api/chats/{id}                 – Получить чат
PUT    /api/chats/{id}                 – Обновить чат
DELETE /api/chats/{id}                 – Удалить чат

GET    /api/chats/{id}/messages        – История сообщений
POST   /api/chats/{id}/messages        – Отправить сообщение (SSE streaming)
```

## Структура проекта

```
ai-chat/
├── backend/
│   ├── main.go                         – Точка входа
│   ├── go.mod
│   ├── internal/
│   │   ├── db/db.go                   – SQLite инициализация
│   │   ├── auth/auth.go               – JWT и хеширование паролей
│   │   ├── models/models.go           – Структуры данных
│   │   ├── store/store.go             – CRUD операции с БД
│   │   ├── ai/client.go               – OpenAI-совместимый клиент
│   │   └── httpapi/
│   │       ├── api.go                 – Маршруты и middleware
│   │       ├── auth_handlers.go       – Auth endpoints
│   │       ├── provider_handlers.go   – Provider endpoints
│   │       └── chat_handlers.go       – Chat endpoints
│   └── chat.db                         – SQLite БД (создаётся автоматически)
│
└── frontend/
    ├── src/
    │   ├── main.tsx                    – Точка входа
    │   ├── App.tsx                     – Маршрутизация
    │   ├── api.ts                      – API клиент и types
    │   ├── store.ts                    – Zustand стор
    │   ├── pages/
    │   │   ├── Login.tsx
    │   │   ├── Register.tsx
    │   │   └── Chat.tsx                – Главное окно
    │   ├── components/
    │   │   └── ProvidersModal.tsx      – Модальное окно провайдеров
    │   └── index.css                   – Tailwind styles
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── index.html
```

## Примеры запросов

### Регистрация
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John"
  }'
```

### Добавление провайдера
```bash
curl -X POST http://localhost:8080/api/providers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "OpenRouter",
    "base_url": "https://openrouter.ai/api/v1",
    "api_key": "sk-or-v1-...",
    "kind": "openai_compatible"
  }'
```

### Отправка сообщения (с потоком)
```bash
curl -X POST http://localhost:8080/api/chats/CHAT_ID/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello!"}' \
  --no-buffer
```

Ответ будет в формате SSE:
```
event: message
data: {"id":"...","role":"user",...}

event: token
data: "Hello"

event: token
data: " world"

event: done
data: {"id":"..."}
```

## Секьюрность

- Пароли хешируются с bcrypt
- JWT токены с истечением 30 дней
- CORS настроен на `*` для разработки – **измените в продакшене**
- SQL-инъекции защищены параметризованными запросами
- Все API endpoints требуют аутентификацию

## Развёртывание в продакшене

1. **Установите переменные окружения:**
   ```bash
   export JWT_SECRET=$(openssl rand -base64 32)
   export CORS_ORIGINS=https://yourdomain.com
   export DB_PATH=/var/lib/ai-chat/chat.db
   export PORT=8080
   ```

2. **Измените хранение API ключей:** текущая реализация хранит ключи в открытом виде. Для продакшена:
   - Используйте шифрование (например, AES-256)
   - Или интегрируйте с системой управления секретами (Vault, AWS Secrets Manager)
   - Пересоздайте `StoreProvider` с шифрованием в `store.go`

3. **Используйте HTTPS:** поместите приложение за reverse proxy (nginx, Caddy) с SSL сертификатом

4. **Соберите фронтенд для продакшена:**
   ```bash
   cd frontend
   npm run build
   # Результат в frontend/dist/ — раздавайте как статику через nginx
   ```

5. **Запустите бэкенд:**
   ```bash
   cd backend
   go build -o server .
   ./server
   ```
   
6. **Мониторинг:** добавьте health check endpoint (например, `GET /health`)

7. **Базовая аудит логирования:** текущий код выводит ошибки в stderr, добавьте структурированное логирование для продакшена

## Развитие

Возможные улучшения:
- Кэширование списка моделей
- Возможность редактирования сообщений
- Экспорт чатов
- Собственные системные промпты
- Редактирование названий чатов
- Темная/светлая тема
- Многоязычность

## Лицензия

MIT

## Контакты

Создано для демонстрации работы с современным стеком: Go, React, SQLite, JWT, SSE.
