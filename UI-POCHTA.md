# UI «Входящая корреспонденция» — принципы

Страница: `/agents/incoming-mail` · API: `agent-pochta` на `:8080` · proxy dev: `/pochta-api`.

## Соответствие платформе

Страница повторяет паттерн **NdControlAgent** (тот же каркас, что на хосте `192.168.1.157:5173`):

| Элемент | Как на сайте |
|---------|----------------|
| Шапка | «Каталог агентов» + заголовок + badge агента |
| Карточки | `--color-surface`, `--shadow-lg`, `border-radius: 12px` |
| Кнопки | `primaryButton` / `secondaryButton` / `ghostButton` |
| Статусы | pill-badges через `--color-success-soft`, `--color-danger-soft`, … |
| Сводка | `summaryRow` / `summaryLabel` / `summaryValue` |
| Формы | `FormSelect`, токены `--form-*` |
| Callout | `infoCallout`, `warningCallout`, `errorCallout` |
| Адаптив | `< 1200px` — одна колонка |

**Не использовать** захардкоженные `#15803d` / `rgba(...)` — только CSS-переменные из `tokens.css` (светлая и тёмная тема).

## Компоновка страницы

```
[ Шапка агента ]
[ 4 KPI: всего / обработано / спам / на проверке ]
[ Список писем + фильтры ]
[ Граф 8 узлов | Детали + HITL | Сводка справа ]
```

Граф слева — read-only отражение LangGraph (`imap_listener` → … → `finalize`), подсветка по статусу письма.

## Human-in-the-loop (ТЗ §8)

| Действие | API |
|----------|-----|
| Восстановить из спама | `POST …/restore-from-spam` |
| Повторить 1С | `POST …/retry-erp` |
| Подтвердить отдел | `POST …/resolve-human` `approve_routing` |
| Проверено (done/error) | `POST …/resolve-human` `mark_verified` |
| Отметить спам | `resolve-human` `mark_spam` |
| Не спам | `resolve-human` `mark_not_spam` |

Отделы для HITL — из платформенного `GET /departments` (основной бэкенд через `/api/v1`).

## Запуск

```cmd
REM agent-pochta
python scripts/run_api.py

REM фронт (portable Node) — или run_frontend.cmd из agent-pochta
cd C:\Users\d.zalibin\agent_nd_front
powershell -ExecutionPolicy Bypass -File .\run-dev.ps1
```

`.env` фронта:

```env
VITE_POCHTA_API_PROXY=http://localhost:8080
VITE_STANDALONE_INCOMING_MAIL=true
VITE_INCOMING_MAIL_PUBLIC=true
```

Страница `/agents/incoming-mail` открывается **без логина** на платформу (`192.168.1.157:5454`). Нужен только `agent-pochta` API на `:8080`.

## Следующие шаги UI

- Карточка агента в каталоге платформы (`agent_pochta` в `/agents/available`)
- Пункт Sidebar «Входящая корреспонденция»
- Превью вложений / тело письма
- Live-обновление через WebSocket или SSE
