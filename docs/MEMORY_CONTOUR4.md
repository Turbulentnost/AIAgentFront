# Memory — Contour4 UI

**Дата:** 2026-07-21  
**Область:** `src/pages/contour4/` (`Contour4AgentWorkspace`, `Contour4WidgetHost`, `contour4Session`)

## Статический аудит

| Паттерн | Вердикт |
|---------|---------|
| Detached DOM / `useRef` на DOM | Нет |
| `addEventListener` без cleanup | Нет |
| Таймеры | Был риск: mock HITL `setTimeout(400)` → `setState` после unmount |
| Unbounded caches | Нет (mock + stub `sessionStorage` одной роли) |
| Тяжёлые closures | Низкий: `onDecide` / статические mock-виджеты |

## Фикс HITL (cancel-safe)

В `Contour4AgentWorkspace.tsx`:

- `HitlPanel`: `aliveRef` + `AbortController` в cleanup `useEffect`; в `finally` — `setSubmitting` только если `aliveRef.current`.
- `submitHitlDecision(payload, signal?)`: `clearTimeout` на abort.
- Workspace: `workspaceAliveRef` перед `setDoneAction` / `setLastIdempotencyKey`.

Паттерн:

```tsx
useEffect(() => {
  let alive = true;
  return () => { alive = false; };
}, []);
// after await:
if (!alive) return;
setSubmitting(false);
```

## DevTools (ручной сценарий)

1. Chrome → `/contour4/executive_director` (или любая роль).
2. Memory → Take heap snapshot (baseline).
3. 10×: открыть другую роль → назад → HITL «Отправка» (не ждать) → сразу сменить URL/роль.
4. Snapshot #2 → Comparison → искать Detached HTML*; рост React fiber без unbound Maps.
5. Performance monitor: JS heap при 10 циклах навигации — плато, не линейный рост.
