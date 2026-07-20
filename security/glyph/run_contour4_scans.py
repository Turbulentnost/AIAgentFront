"""Run Glyph AnalysisEngine on Contour4 front synthetic MCP configs."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from glyph.cli import get_all_rules
from glyph.engine.analyzer import AnalysisEngine
from glyph.models.config import (
    ConfigFormat,
    MCPConfig,
    MCPServer,
    Tool,
    TransportConfig,
    TransportType,
)
from glyph.models.finding import Severity
from glyph.reporter.human import HumanReporter
from glyph.reporter.json_report import JsonReporter

ROOT = Path(__file__).resolve().parent
GENERATED = ROOT / "generated"
REPORTS = ROOT / "reports"

ROLE_IDS = (
    "cfo_head",
    "finance_director",
    "executive_director",
    "chief_accountant",
    "accountant",
    "legal_specialist",
)


def load_config_with_tools(path: Path) -> MCPConfig:
    data = json.loads(path.read_text(encoding="utf-8"))
    servers: list[MCPServer] = []
    for name, server_cfg in data.get("mcpServers", {}).items():
        command = [server_cfg["command"]] if "command" in server_cfg else []
        args = list(server_cfg.get("args") or [])
        tools = [
            Tool(
                name=t["name"],
                description=t.get("description") or "",
                server_name=name,
                schema=t.get("inputSchema") or {},
            )
            for t in server_cfg.get("tools") or []
        ]
        servers.append(
            MCPServer(
                name=name,
                transport=TransportConfig(
                    type=TransportType.STDIO, command=command, args=args
                ),
                tools=tools,
                env_vars=dict(server_cfg.get("env") or {}),
            )
        )
    return MCPConfig(
        file_path=path,
        format=ConfigFormat.CLAUDE_DESKTOP,
        servers=servers,
        raw_data=data,
    )


def exit_code_for(results) -> int:
    has_critical = any(
        f.severity == Severity.CRITICAL for r in results for f in r.findings
    )
    has_findings = any(r.findings for r in results)
    if has_critical:
        return 2
    if has_findings:
        return 1
    return 0


def main() -> int:
    REPORTS.mkdir(parents=True, exist_ok=True)
    summary_rows: list[dict] = []
    worst_exit = 0

    for agent_id in ROLE_IDS:
        path = GENERATED / f"{agent_id}.mcp.json"
        if not path.is_file():
            print(f"MISSING {path}", file=sys.stderr)
            summary_rows.append(
                {"agent": agent_id, "status": "MISSING_CONFIG", "exit_code": 2, "findings": 0}
            )
            worst_exit = max(worst_exit, 2)
            continue

        config = load_config_with_tools(path)
        results = AnalysisEngine(get_all_rules()).analyze_all([config])
        code = exit_code_for(results)
        worst_exit = max(worst_exit, code)

        (REPORTS / f"{agent_id}.glyph.json").write_text(
            JsonReporter().generate(results), encoding="utf-8"
        )
        (REPORTS / f"{agent_id}.glyph.txt").write_text(
            HumanReporter().generate(results), encoding="utf-8"
        )

        findings = [f for r in results for f in r.findings]
        by_sev: dict[str, int] = {}
        for f in findings:
            by_sev[f.severity.value] = by_sev.get(f.severity.value, 0) + 1

        summary_rows.append(
            {
                "agent": agent_id,
                "status": "FAIL" if code else "PASS",
                "exit_code": code,
                "findings": len(findings),
                "by_severity": by_sev,
                "rules": sorted({f.rule_id for f in findings}),
                "titles": [
                    {
                        "severity": f.severity.value,
                        "rule": f.rule_id,
                        "title": f.title,
                        "location": f.location,
                        "evidence": getattr(f, "evidence", None),
                    }
                    for f in findings
                ],
            }
        )
        print(f"{agent_id}: exit={code} findings={len(findings)}")

    index = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "engine": "glyph AnalysisEngine (Contour4 front bridge)",
        "note": "CLI glyph scan ignores tools[]; runner attaches descriptions from mock HITL/widgets.",
        "agents": summary_rows,
        "worst_exit_code": worst_exit,
    }
    (REPORTS / "roles_index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return worst_exit


if __name__ == "__main__":
    raise SystemExit(main())
