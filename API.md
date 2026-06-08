# API Backend — справочник для фронтенда

> **Назначение файла:** подключение фронтенда к бэкенду «Корпоративная платформа ИИ-агентов».  
> Cursor / IDE во фронтенд-проекте может использовать этот документ как контракт API.

---

## Базовая конфигурация

| Параметр | Значение |
|----------|----------|
| **Base URL (prod/сервер)** | `http://192.168.1.157:8000` *(уточните порт на сервере)* |
| **Base URL (локально)** | `http://localhost:8000` |
| **API prefix** | `/api/v1` |
| **Полный базовый URL API** | `{BASE_URL}/api/v1` |
| **OpenAPI JSON** | `{BASE_URL}/api/v1/openapi.json` |
| **Swagger UI** | `{BASE_URL}/docs` |
| **ReDoc** | `{BASE_URL}/redoc` |
| **Корень приложения** | `GET /` — `{ name, version, docs, api }` |
| **Метрики Prometheus** | `GET /metrics` *(вне `/api/v1`)* |

### Переменные окружения фронтенда (рекомендация)

```env
VITE_API_BASE_URL=http://192.168.1.157:8000
VITE_API_PREFIX=/api/v1
```

### CORS

Бэкенд читает `BACKEND_CORS_ORIGINS` (через запятую). По умолчанию разрешены:

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://192.168.1.157:5173`

`allow_credentials: true` — cookies/credentials поддерживаются, если фронт их использует.

---

## Аутентификация

**Схема:** OAuth2 Password Bearer (JWT).

| Заголовок | Значение |
|-----------|----------|
| `Authorization` | `Bearer {access_token}` |
| `Content-Type` | `application/json` *(кроме upload — `multipart/form-data`)* |

**Token URL (для OAuth2-клиентов):** `POST /api/v1/auth/login`

### Получение токена

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secret"
}
```

**Ответ `200` — `Token`:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_at": "2026-06-05T12:00:00Z"
}
```

**Ошибки login:**
| Код | Ситуация |
|-----|----------|
| `400` | Невалидные данные |
| `401` | Неверный email/пароль |
| `428` | Требуется смена пароля — передайте `new_password` в теле login |

### Типичный flow на фронте

1. `POST /auth/login` → сохранить `access_token` (memory / secure storage).
2. Все защищённые запросы: `headers: { Authorization: \`Bearer ${token}\` }`.
3. `GET /auth/me` — текущий пользователь при загрузке приложения.
4. `POST /auth/refresh` — обновить токен (нужен действующий token).
5. `POST /auth/logout` — отозвать сессию (`204`, без тела).

### Права доступа

| Роль | Условие |
|------|---------|
| **Аноним** | Эндпоинты без `🔒` |
| **Авторизованный** | Любой активный пользователь с валидным JWT |
| **Админ** | `user.is_superuser === true` |

---

## Общие соглашения

- **ID:** UUID v4 (`"550e8400-e29b-41d4-a716-446655440000"`).
- **Даты:** ISO 8601 UTC (`datetime` в JSON).
- **Пагинация:** query-параметры `limit` (default 50) и `offset` (default 0) — где указано.
- **Ошибки FastAPI:**
  ```json
  { "detail": "Текст ошибки" }
  ```
  или `{ "detail": { "code": "...", "message": "..." } }` для `428`.
- **Upload:** `multipart/form-data`, поле файла — `file`.
- **Поля metadata в ответах:** в JSON приходят как `"metadata"` (alias для `metadata_`).

---

## Каталог эндпоинтов

Обозначения: 🔒 — нужен JWT, 👑 — только `is_superuser`.

---

### Health

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `GET` | `/api/v1/health` | — | Статус приложения |
| `GET` | `/api/v1/ready` | — | Readiness (+ проверка БД, `503` при ошибке) |

**Ответ `HealthResponse`:**
```json
{ "status": "ok", "environment": "dev", "version": "0.1.0", "checks": { "database": "ok" } }
```

---

### Auth (`/api/v1/auth`)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `POST` | `/auth/login` | — | Вход, получение JWT |
| `POST` | `/auth/refresh` | 🔒 | Новый access token |
| `POST` | `/auth/logout` | 🔒 | Выход (`204`) |
| `GET` | `/auth/me` | 🔒 | Текущий пользователь (`UserRead`) |

**LoginRequest:** `{ email, password, new_password? }`

---

### Users (`/api/v1/users`)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `GET` | `/users?limit&offset` | 👑 | Список пользователей |
| `GET` | `/users/{user_id}` | 🔒 | Профиль (свой или 👑) |
| `PATCH` | `/users/{user_id}` | 🔒 | Обновление профиля (не-админ — только свои поля) |
| `POST` | `/users/{user_id}/deactivate` | 👑 | Деактивация |
| `POST` | `/users/{user_id}/avatar` | 🔒 | Загрузка аватара (`multipart`, поле `file`) |

**UserRead (основные поля):**
```typescript
{
  id: string;
  email: string;
  username?: string;
  last_name?, first_name?, middle_name?, full_name?;
  phone?, position?;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  must_change_password: boolean;
  department_id?: string;
  role_id?: string;
  avatar_url?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}
```

**UserUpdate:** частичное обновление — `email`, `username`, ФИО, `phone`, `position`, `department_id`, `role_id`, флаги *(админ)*.

**Self-update (не админ):** только `email`, `username`, `last_name`, `first_name`, `middle_name`, `full_name`, `phone`, `position`.

---

### Admin Users (`/api/v1/admin/users`) — все 👑

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/admin/users?limit&offset` | Список |
| `POST` | `/admin/users` | Создание пользователя |
| `POST` | `/admin/users/{user_id}/deactivate` | Деактивация |

**AdminUserCreate:**
```typescript
{
  email: string;
  password: string;          // min 8
  username?, last_name?, first_name?, middle_name?, full_name?;
  phone?, position?;
  department_id?, role_id?;
  is_active?: boolean;       // default true
  is_verified?: boolean;     // default true
  is_superuser?: boolean;   // default false
  must_change_password?: boolean; // default true
  agent_access?: Array<{
    agent_id: string;
    access_level?: string;   // default "run"
    can_run?: boolean;
    can_view_results?: boolean;
    can_approve?: boolean;
    can_configure?: boolean;
    expires_at?: string;
  }>;
}
```

---

### Departments (`/api/v1/departments`)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `GET` | `/departments?limit=1000&offset` | 🔒 | Список подразделений |
| `GET` | `/departments/sync/status` | 🔒 | Статус синхронизации с 1С |
| `POST` | `/departments/sync` | 👑 | Синхронизация из 1С (`429` — cooldown) |
| `POST` | `/departments` | 👑 | Создание |
| `PATCH` | `/departments/{department_id}` | 👑 | Обновление |

**DepartmentRead:** `{ id, name, slug, description?, parent_id?, is_active, source_system?, external_id?, created_at, updated_at }`

**DepartmentCreate:** `{ name, slug, description?, parent_id?, is_active? }`

---

### Agents (`/api/v1/agents`)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `GET` | `/agents/available` | 🔒 | **Агенты, доступные текущему пользователю** (+ права) |
| `GET` | `/agents?limit&offset` | — | Все агенты из БД (без фильтра прав) |
| `POST` | `/agents` | — | Создание |
| `GET` | `/agents/{agent_id}` | — | Один агент |
| `PATCH` | `/agents/{agent_id}` | — | Обновление |

> **Для UI пользователя используйте `GET /agents/available`.**  
> `GET /agents` — полный каталог (сейчас без auth; для админки/отладки).

**AgentRead:**
```typescript
{
  id: string;
  name: string;
  slug: string;
  purpose?: string;
  status: AgentStatus;
  input_schema?: object;
  output_schema?: object;
  department_id?: string;
  owner_id?: string;
  created_at: string;
  updated_at: string;
}
```

**AgentAccessRead** = `AgentRead` + `{ access_level?, can_run, can_view_results, can_approve, can_configure }`

**AgentCreate:** `{ name, slug, purpose?, input_schema?, output_schema?, department_id? }`

**AgentUpdate:** `{ name?, purpose?, status?, input_schema?, output_schema? }`

---

### Tasks (`/api/v1/tasks`)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `GET` | `/tasks?limit&offset` | — | Список задач |
| `POST` | `/tasks` | 🔒 | Создать задачу (если есть `agent_id` — ставится в Celery) |
| `GET` | `/tasks/{task_id}` | — | Задача по ID |
| `GET` | `/tasks/{task_id}/steps` | — | Шаги задачи |
| `GET` | `/tasks/{task_id}/result` | — | Текущий результат |
| `POST` | `/tasks/{task_id}/result` | — | Сохранить результат |
| `POST` | `/tasks/debug-celery` | — | Отладка Celery |
| `GET` | `/tasks/celery/{celery_task_id}` | — | Статус Celery-задачи |

**TaskCreate:**
```typescript
{
  title: string;
  description?: string;
  agent_id?: string;
  document_ids?: string[];
  task_type?: string;
  input_payload?: object;
  run_parameters?: object;
  requires_human_review?: boolean;
  task_metadata?: object;
}
```

**TaskRead:** `{ id, title, description?, status, agent_id?, created_by_id?, document_ids[], task_type?, input_payload?, run_parameters?, celery_task_id?, requires_human_review, started_at?, finished_at?, error_message?, task_metadata?, created_at, updated_at }`

**TaskStatus:** `pending` \| `planning` \| `running` \| `waiting_human` \| `completed` \| `completed_with_issues` \| `failed` \| `cancelled`

---

### Documents (`/api/v1/documents`)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `POST` | `/documents/upload` | 🔒 | Загрузка файла |
| `POST` | `/documents` | 🔒 | Загрузка (legacy alias → `/upload`) |
| `GET` | `/documents` | 🔒 | Список (фильтр по `department_id` для не-админа) |
| `POST` | `/documents/search` | 🔒 | Семантический поиск по базе знаний |
| `POST` | `/documents/{document_id}/parse` | 🔒 | Запуск парсинга (Celery) |
| `GET` | `/documents/{document_id}/versions` | 🔒 | Версии документа |
| `GET` | `/documents/versions/{document_version_id}/chunks` | 🔒 | Чанки версии |

**Upload (`multipart/form-data`):**

| Поле | Тип | Обязательно | Default |
|------|-----|-------------|---------|
| `file` | file | да | — |
| `title` | string | нет | имя файла |
| `document_type` | enum | нет | `other` |
| `department_id` | uuid | нет | dept пользователя |
| `task_id` | uuid | нет | — |
| `is_knowledge_base` | bool | нет | `false` |
| `source_url` | string | нет | — |
| `metadata` | string (JSON) | нет | — |

**ChunkSearchQuery (POST /documents/search):**
```typescript
{
  query: string;
  top_k?: number;              // default 5
  document_types?: DocumentType[];
  department_ids?: string[];
  document_version_id?: string;
  access_scopes?: string[];
  knowledge_base_id?: string;
  agent_id?: string;
}
```

**ChunkSearchHit:** `{ content, score, document_id?, document_version_id?, chunk_id?, document_title?, document_type?, page_number?, section_title?, metadata? }`

---

### Knowledge Bases (`/api/v1/knowledge-bases`) — все 🔒

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/knowledge-bases/stats` | Сводная статистика |
| `GET` | `/knowledge-bases?status&department_id&responsible_user_id&query` | Список |
| `POST` | `/knowledge-bases` | Создание |
| `GET` | `/knowledge-bases/{id}` | Одна БЗ |
| `PATCH` | `/knowledge-bases/{id}` | Обновление |
| `DELETE` | `/knowledge-bases/{id}` | Архивация (возвращает `KnowledgeBaseRead`) |
| `GET` | `/knowledge-bases/{id}/sources` | Источники |
| `POST` | `/knowledge-bases/{id}/sources` | Добавить документ |
| `DELETE` | `/knowledge-bases/{id}/sources/{source_id}` | Удалить источник (`204`) |
| `POST` | `/knowledge-bases/{id}/sources/{source_id}/reindex` | Переиндекс источника |
| `GET` | `/knowledge-bases/{id}/chunks` | Фрагменты |
| `PATCH` | `/knowledge-bases/{id}/chunks/{kb_chunk_id}/exclude` | Исключить/вернуть фрагмент |
| `GET` | `/knowledge-bases/{id}/rules` | Правила |
| `POST` | `/knowledge-bases/{id}/rules` | Создать правило |
| `GET` | `/knowledge-bases/{id}/access` | Права доступа |
| `PUT` | `/knowledge-bases/{id}/access` | Заменить права (+ reindex job) |
| `GET` | `/knowledge-bases/{id}/agents` | Привязки агентов |
| `PUT` | `/knowledge-bases/{id}/agents` | Заменить привязки |
| `POST` | `/knowledge-bases/{id}/index` | Запуск индексации |
| `GET` | `/knowledge-bases/{id}/index/jobs` | Jobs индексации |
| `GET` | `/knowledge-bases/index/jobs/{job_id}/errors` | Ошибки job |
| `POST` | `/knowledge-bases/index/errors/{error_id}/retry` | Повтор после ошибки |
| `POST` | `/knowledge-bases/{id}/test-search` | Тестовый поиск |
| `GET` | `/knowledge-bases/{id}/audit` | Аудит-лог |

**KnowledgeBaseCreate:**
```typescript
{
  name: string;
  description?: string;
  department_id?: string;
  responsible_user_id?: string;
  topic?, process_slug?, embedding_model?;
  metadata?: object;
  access_grants?: KnowledgeBaseAccessGrantInput[];
  source_document_ids?: string[];
}
```

**KnowledgeBaseRead:** `{ id, name, description?, department_id?, owner_user_id?, responsible_user_id?, topic?, process_slug?, status, embedding_model?, vector_store, qdrant_collection, last_indexed_at?, is_public, sources_count, fragments_count, storage_bytes, metadata?, created_at, updated_at }`

**KnowledgeBaseAgentBindingInput:** `{ agent_id, access_mode?, expires_at?, is_enabled? }`  
**access_mode:** `search_only` \| `search_and_cite` \| `decision` \| `auto_action`

**KnowledgeBaseIndexRequest:** `{ job_type?, source_id?, chunk_id? }`  
**job_type:** `full` \| `source` \| `chunk` \| `embeddings` \| `access_reindex`

---

### Browser Runs (`/api/v1/browser-runs`) — все 🔒

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/browser-runs` | Создать запрос на открытие URL |
| `GET` | `/browser-runs/pending` | Ожидающие runs для текущего пользователя |
| `GET` | `/browser-runs/{run_id}` | Статус run |
| `POST` | `/browser-runs/{run_id}/result` | Отправить результат (расширение/клиент) |

**BrowserRunCreate:**
```typescript
{
  url: string;
  extract_mode?: "text" | "html" | "screenshot" | "table";  // default "text"
  reason: string;        // min 3 chars
  timeout_seconds?: number;  // 1–60, default 30
  task_id?: string;
  agent_id?: string;
}
```

**BrowserRunResult:** `{ status?, title?, text?, html?, tables?, screenshot_data_url?, error_message?, metadata? }`

---

## Справочник enum-значений

### AgentStatus
`draft` \| `testing` \| `ope` \| `refinement` \| `active` \| `suspended` \| `archived`

### DocumentType
`task_input` \| `regulation` \| `tz` \| `pmi` \| `kd` \| `td` \| `contract` \| `specification` \| `act` \| `checklist` \| `protocol` \| `order` \| `memo` \| `other`

### KnowledgeBaseStatus
`draft` \| `processing` \| `needs_review` \| `ready` \| `updating` \| `error` \| `archived`

### BrowserRunStatus
`pending` \| `running` \| `completed` \| `failed` \| `timeout` \| `cancelled`

---

## Примеры интеграции (TypeScript / fetch)

### API-клиент

```typescript
const API = `${import.meta.env.VITE_API_BASE_URL}/api/v1`;

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw await res.json();
  return res.json() as Promise<{ access_token: string; expires_at?: string }>;
}

export async function getMe(token: string) {
  const res = await fetch(`${API}/auth/me`, { headers: authHeaders(token) });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function getAvailableAgents(token: string) {
  const res = await fetch(`${API}/agents/available`, { headers: authHeaders(token) });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function uploadDocument(token: string, file: File, meta?: { title?: string; document_type?: string }) {
  const form = new FormData();
  form.append("file", file);
  if (meta?.title) form.append("title", meta.title);
  if (meta?.document_type) form.append("document_type", meta.document_type);
  const res = await fetch(`${API}/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw await res.json();
  return res.json();
}
```

### React Query keys (рекомендация)

| Key | Эндпоинт |
|-----|----------|
| `['auth', 'me']` | `GET /auth/me` |
| `['agents', 'available']` | `GET /agents/available` |
| `['departments']` | `GET /departments` |
| `['documents']` | `GET /documents` |
| `['knowledge-bases']` | `GET /knowledge-bases` |
| `['tasks', taskId]` | `GET /tasks/{id}` |

---

## Карта экранов → API

| Экран / функция | Эндпоинты |
|-----------------|-----------|
| Login | `POST /auth/login` |
| Профиль / header | `GET /auth/me`, `PATCH /users/{id}`, `POST /users/{id}/avatar` |
| Список агентов (пользователь) | `GET /agents/available` |
| Запуск задачи агента | `POST /tasks`, polling `GET /tasks/{id}`, `GET /tasks/{id}/result` |
| Загрузка документов | `POST /documents/upload`, `GET /documents` |
| Базы знаний | CRUD `/knowledge-bases/*` |
| Админ: пользователи | `/admin/users`, `/users` |
| Админ: подразделения | `/departments`, `/departments/sync` |
| Browser extension | `GET /browser-runs/pending`, `POST /browser-runs/{id}/result` |

---

## Генерация типов из OpenAPI

```bash
# пример: openapi-typescript
npx openapi-typescript http://192.168.1.157:8000/api/v1/openapi.json -o src/api/schema.d.ts
```

Или в Cursor фронтенда: `@API.md` + `@openapi.json` — для автодополнения запросов.

---

## Версия документа

- **Backend version:** `0.1.0` (`APP_VERSION`)
- **Сгенерировано по коду:** ветка `main`, FastAPI router `app/api/v1/`

При изменении API на бэкенде обновляйте этот файл или перегенерируйте клиент из `/api/v1/openapi.json`.
