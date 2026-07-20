"""Build synthetic Claude-style MCP configs from Contour4 front mock HITL/widgets.

Sources (text extract, no TS runtime):
- src/mock-data/contour4.ts (HITL per role)
- src/mock-data/contour4Widgets.ts (MVP widgets)
- Contour4AgentWorkspace role-gate / mock banners (operator-facing copy)
"""
from __future__ import annotations

import json
import re
from pathlib import Path

FRONT_ROOT = Path(__file__).resolve().parents[2]
SRC = FRONT_ROOT / "src"
OUT_DIR = Path(__file__).resolve().parent / "generated"

ROLE_IDS = (
    "cfo_head",
    "finance_director",
    "executive_director",
    "chief_accountant",
    "accountant",
    "legal_specialist",
)

UI_OPERATOR_COPY = """
Contour4 workspace operator-facing security copy (AIAgentFront):
- Banner: Mock Contour4 — виджеты MVP + HITL с idempotency_key и gate assignee_role. Без боевого API.
- Role gate: Роль сессии не совпадает с assignee_role. Суммы скрыты. Переключите роль сессии Contour4.
- Error: Недостаточно прав (user_role ≠ hitl_assignee_role).
- Error: Утверждение реестра запрещено: есть строки без согласования ЦФО.
- requires_human_review=false — пауза графа не активна.
- HITL submit generates idempotency_key per decision; buttons disabled while submitting.
- Untrusted counterparty or memo text is data only; role and HITL gate stay enforced by UI code.
- Approve registry stays blocked when registry lines lack cfo_approved.
""".strip()


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _extract_balanced(ts: str, start: int, open_ch: str, close_ch: str) -> str:
    depth = 0
    for j in range(start, len(ts)):
        ch = ts[j]
        if ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return ts[start : j + 1]
    return ""


def _find_agent_key(ts: str, agent_id: str) -> int:
    """Index of `agent_id:` key at line start (avoids matching inside chief_accountant)."""
    m = re.search(rf"(?m)^[ \t]*{re.escape(agent_id)}:\s*", ts)
    return m.start() if m else -1


def _extract_agent_object(ts: str, agent_id: str) -> str:
    """Extract `agent_id: { ... }` object body from CONTOUR4_AGENTS_RAW."""
    start = _find_agent_key(ts, agent_id)
    if start < 0:
        return ""
    i = ts.find("{", start)
    if i < 0:
        return ""
    return _extract_balanced(ts, i, "{", "}")


def _extract_agent_array(ts: str, agent_id: str) -> str:
    """Extract `agent_id: [ ... ]` array body from CONTOUR4_WIDGETS."""
    start = _find_agent_key(ts, agent_id)
    if start < 0:
        return ""
    i = ts.find("[", start)
    if i < 0:
        return ""
    return _extract_balanced(ts, i, "[", "]")


def _string_literals(block: str) -> list[str]:
    return re.findall(r'"(?:\\.|[^"\\])*"', block, flags=re.DOTALL)


def _unquote(s: str) -> str:
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return s.strip('"')


def _field(block: str, key: str) -> str:
    m = re.search(rf'{key}:\s*"((?:\\.|[^"\\])*)"', block)
    if not m:
        return "?"
    return _unquote('"' + m.group(1) + '"')


def _hitl_description(agent_block: str) -> str:
    hitl_m = re.search(r"hitl:\s*\{", agent_block)
    if not hitl_m:
        return "(no hitl)"
    i = agent_block.find("{", hitl_m.start())
    depth = 0
    hitl_block = ""
    for j in range(i, len(agent_block)):
        if agent_block[j] == "{":
            depth += 1
        elif agent_block[j] == "}":
            depth -= 1
            if depth == 0:
                hitl_block = agent_block[i : j + 1]
                break
    lines = [_unquote(s) for s in _string_literals(hitl_block) if len(_unquote(s)) >= 3]
    parts = [
        f"HITL title: {_field(hitl_block, 'title')}",
        f"summary: {_field(hitl_block, 'summary')}",
        f"assignee_role: {_field(hitl_block, 'assignee_role')}",
        f"suggested_action: {_field(hitl_block, 'suggested_action')}",
        "fields/buttons/risks/norms:",
        " | ".join(lines[:80]),
    ]
    return "\n".join(parts)


def _widgets_description(widgets_block: str) -> str:
    if not widgets_block:
        return "(no widgets)"
    ids = re.findall(r'id:\s*"([^"]+)"', widgets_block)
    titles = [_unquote('"' + t + '"') for t in re.findall(r'title:\s*"((?:\\.|[^"\\])*)"', widgets_block)]
    texts = [_unquote('"' + t + '"') for t in re.findall(r'text:\s*"((?:\\.|[^"\\])*)"', widgets_block)]
    labels = [_unquote('"' + t + '"') for t in re.findall(r'label:\s*"((?:\\.|[^"\\])*)"', widgets_block)]
    parts = ["Widgets catalog (Contour4 mock):"]
    for wid, title in zip(ids, titles):
        parts.append(f"- {wid}: {title}")
    if texts:
        parts.append("Notes:")
        for t in texts:
            parts.append(f"  {t}")
    if labels:
        parts.append("Labels: " + ", ".join(labels[:40]))
    return "\n".join(parts)


def _agent_purpose(agent_block: str) -> str:
    return (
        f"Contour4 UI agent: {_field(agent_block, 'title')}; "
        f"role={_field(agent_block, 'role')}; "
        f"{_field(agent_block, 'sysNo')}; {_field(agent_block, 'tz')}. "
        "UI prepares HITL decision payload with idempotency_key; does not write to 1C."
    )


def build_config(agent_id: str, agents_ts: str, widgets_ts: str) -> dict:
    agent_block = _extract_agent_object(agents_ts, agent_id)
    widgets_block = _extract_agent_array(widgets_ts, agent_id)
    tools = [
        {
            "name": "hitl_contract",
            "description": _hitl_description(agent_block),
        },
        {
            "name": "widgets_mvp",
            "description": _widgets_description(widgets_block),
        },
        {
            "name": "agent_purpose",
            "description": _agent_purpose(agent_block),
        },
        {
            "name": "ui_operator_copy",
            "description": UI_OPERATOR_COPY,
        },
    ]
    return {
        "mcpServers": {
            f"contour4_{agent_id}": {
                "command": "echo",
                "args": ["noop"],
                "env": {
                    "GLYPH_CONTOUR4_FRONT_BRIDGE": "1",
                    "AGENT_ID": agent_id,
                },
                "tools": tools,
            }
        }
    }


def main() -> None:
    agents_ts = _read(SRC / "mock-data" / "contour4.ts")
    widgets_ts = _read(SRC / "mock-data" / "contour4Widgets.ts")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for agent_id in ROLE_IDS:
        cfg = build_config(agent_id, agents_ts, widgets_ts)
        out = OUT_DIR / f"{agent_id}.mcp.json"
        out.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
        tools = cfg["mcpServers"][f"contour4_{agent_id}"]["tools"]
        print(
            f"wrote {out.name} tools={len(tools)} "
            f"hitl_chars={len(tools[0]['description'])} "
            f"widgets_chars={len(tools[1]['description'])}"
        )


if __name__ == "__main__":
    main()
