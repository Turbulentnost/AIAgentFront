# Glyph: Contour4 Front (6 ролей)

Дата: 2026-07-20  
Инструменты: `glyph-scan` 0.3.0 (AnalysisEngine + tools), AIAgentFront Contour4 mock.

## Метод

1. `security/glyph/build_contour4_mcp_configs.py` — синтетический MCP из:
   - HITL (`src/mock-data/contour4.ts`)
   - widgets (`src/mock-data/contour4Widgets.ts`)
   - operator copy (role-gate / idempotency / ABAC messages)
2. `security/glyph/run_contour4_scans.py` — Glyph rules с явным `Tool.description` (CLI `glyph scan` `tools[]` не читает).
3. Smoke: `npm run build` (tsc + vite) — **PASS**.

## Сводка

| Роль | Glyph | Findings | Triage |
|------|-------|----------|--------|
| cfo_head | PASS | 0 | — |
| finance_director | PASS | 0 | — |
| executive_director | FAIL | 4× high `command-injection` «Java System Call», evidence `exec`/`EXEC` | **FP**: `\bexec` без конца слова → `executive` / `W-EXEC-*` |
| chief_accountant | FAIL | 1× high `command-injection` «Java System Call» | **FP**: подстрока `exec` в тексте виджета/лейблах (не shell) |
| accountant | PASS | 0 | — |
| legal_specialist | PASS | 0 | — |

**prompt-injection / tool-poisoning / credential-exposure / data-exfiltration:** 0 по всем ролям.

**npm run build:** PASS (vite built successfully).

## Known FP (как на бэке)

Паттерн Glyph `\b(?:Runtime\.getRuntime|ProcessBuilder|exec)` срабатывает на `executive` / `W-EXEC` / `execution`. Правки mock UI не требуются.

ONNX semantic model: HTTP 404 — `semantic-poisoning` деградирует.

## Next actions

1. Принять front Glyph-gate; FP `exec*` — known.
2. Опционально: triage-фильтр в `run_contour4_scans.py` (как обсуждалось для бэка).
3. После боевого API — пересканировать HITL payload-shape / реальные recommendation texts.

## Повтор

```bash
cd AIAgentFront
python security/glyph/build_contour4_mcp_configs.py
python security/glyph/run_contour4_scans.py
npm run build
```

Артефакты: `security/glyph/reports/*.glyph.json`, `roles_index.json`, этот SUMMARY.
