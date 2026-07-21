# AgentAuditKit — отчёт по AIAgentFront

**Дата:** 2026-07-21  
**Цель:** `AIAgentFront`  
**Инструмент:** `agent-audit-kit` (через `uvx`)  
**Артефакт полного скана:** [`security-audit-reports/audit-AIAgentFront.json`](../../security-audit-reports/audit-AIAgentFront.json)

## Команда

```bash
uvx agent-audit-kit scan AIAgentFront \
  --config .agent-audit-kit.yml \
  --format json --severity low --score \
  -o security-audit-reports/audit-AIAgentFront.json
```

Конфиг: [`.agent-audit-kit.yml`](../../.agent-audit-kit.yml) в корне workspace.

## Итог после ignore-шума

| Метрика | До ignore | После ignore |
|---------|-----------|--------------|
| Critical | 38 | **0** |
| High | 0 | **0** |
| Medium | 34 | **1** (`AAK-LEGAL-002`) |
| Total | 73 | **1** (в findings) |
| Score / Grade | 0 / F | **93 / A** |
| Findings в `src/` | 0 | **0** |

Exit code 0 (`fail-on: high`, critical/high нет).

## Что вынесено в ignore

В [`.agent-audit-kit.yml`](../../.agent-audit-kit.yml):

- `.cursorrules` — IDE rules, не runtime Contour4 UI (раньше 38× `AAK-AGENT-001`).
- Файлы `security/glyph/generated/*.mcp.json` — synthetic MCP для Glyph (раньше medium MCP/poison/attest).
- `**/node_modules/`, `**/dist/` (glob в AAK как prefix почти не работает; оставлены для документации/будущих версий).

**Замечание Windows:** фильтр AAK делает `startswith(prefix + "/")`. Findings на Win приходят с `\`, поэтому **каталог** `security/glyph/generated` не матчится; в конфиге перечислены **точные пути файлов** (и `/`, и `\`).

## Остаток triage

### Medium — `AAK-LEGAL-002` → `package.json`

Dependency без declared license.  
Вердикт: **процессный**, не Contour4 HITL/ABAC; разобрать при compliance-ревью зависимостей.

### App Contour4 (`src/`)

Находок **нет**.

## Связь

- Glyph по ролям: [`security/glyph/reports/SUMMARY.md`](../security/glyph/reports/SUMMARY.md).
- Memory Contour4 UI: [`MEMORY_CONTOUR4.md`](./MEMORY_CONTOUR4.md).
- Ранее AAK гоняли на **`agents_contour4`** (PASS после фиксов); этот прогон — фронт с очищенным ignore.
