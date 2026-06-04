# Frontend

React + Vite интерфейс платформы ИИ-агентов.

## Команды

Установка зависимостей:

```powershell
npm install
```

Запуск dev-сервера:

```powershell
npm run dev -- --host 0.0.0.0
```

Сборка:

```powershell
npm run build
```

Preview production-сборки:

```powershell
npm run preview -- --host 0.0.0.0
```

## Адрес

Локально:

```text
http://localhost:5173
```

Из локальной сети:

```text
http://192.168.1.157:5173
```

API proxy настраивается через `VITE_API_PROXY`, пример:

```env
VITE_API_PROXY=http://192.168.1.157:5454
```
