import { useState } from "react";
import { FileSearch } from "lucide-react";
import type { OmtoRunResult } from "@/types/omto";
import styles from "./OmtoAgentDashboard.module.css";

// Компактный триггер «Что нашёл агент» + всплывающий поповер с результатом.
// Данные берутся из output_data запуска. Поповер имеет свой скролл — карточка
// подтверждения остаётся маленькой, детали показываются по наведению/клику.

type Dict = Record<string, unknown>;

function asArray(value: unknown): Dict[] {
  return Array.isArray(value) ? (value.filter((v) => v && typeof v === "object") as Dict[]) : [];
}

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

const VERDICT_LABEL: Record<string, string> = {
  allow: "РАЗРЕШЕНИЕ",
  deny: "ЗАПРЕТ",
  approve: "СОГЛАСОВАНИЕ",
  conditional: "УСЛОВИЯ ДОПУСКА",
  reject: "ОТКАЗ"
};

const DRAFT_KEYS: Array<[string, string]> = [
  ["order_draft", "Проект заказа"],
  ["contract_draft", "Проект договора"],
  ["rfq_draft", "Проект RFQ"],
  ["claim_draft", "Проект претензии"],
  ["assignment_draft", "Проект назначения"],
  ["decision_card", "Карточка решения"],
  ["escalation", "Эскалация"],
  ["daily_report", "Ежедневный отчёт"]
];

export function HitlDecisionCard({ result }: { result: OmtoRunResult }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;

  const data = (result.output_data || {}) as Dict;
  const findings = asArray(data.findings).slice(0, 8);
  const sources = asArray(data.source_references).slice(0, 8);
  const verdict = str(data.verdict);
  const coverage = data.coverage;
  const riskLevel = str(data.risk_level);
  const conditions = Array.isArray(data.conditions)
    ? (data.conditions as unknown[]).map(str).filter(Boolean)
    : [];
  const draft = DRAFT_KEYS.find(([key]) => data[key] && typeof data[key] === "object");

  const findingsTotal = asArray(data.findings).length;
  const sourcesTotal = asArray(data.source_references).length;

  return (
    <span
      className={styles.hitlDetailsWrap}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        className={styles.hitlDetailsTrigger}
        onClick={() => setPinned((v) => !v)}
        type="button"
      >
        <FileSearch size={15} /> Что нашёл агент
      </button>

      {open ? (
        <div className={styles.hitlPopover} role="dialog">
          {result.summary ? <div className={styles.popSummary}>{result.summary}</div> : null}

          {(verdict || coverage !== undefined || riskLevel) && (
            <div className={styles.popHighlights}>
              {verdict ? (
                <span className={styles.popBadge}>
                  Вердикт: <b>{VERDICT_LABEL[verdict] || verdict}</b>
                </span>
              ) : null}
              {typeof coverage === "number" ? (
                <span className={styles.popBadge}>
                  Покрытие: <b>{coverage}%</b>
                </span>
              ) : null}
              {riskLevel ? (
                <span className={styles.popBadge}>
                  Риск: <b>{riskLevel}</b>
                </span>
              ) : null}
            </div>
          )}

          {draft ? (
            <div className={styles.popSection}>
              <div className={styles.popHead}>{draft[1]}</div>
              <div className={styles.popKv}>
                {Object.entries(data[draft[0]] as Dict)
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <div key={k}>
                      <span>{k}</span>
                      <b>{str(v) || (typeof v === "object" ? "…" : "")}</b>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          {findings.length ? (
            <div className={styles.popSection}>
              <div className={styles.popHead}>
                Выявлено ({findingsTotal})
              </div>
              <ul className={styles.popList}>
                {findings.map((f, i) => (
                  <li key={i}>
                    <span className={styles.popSev} data-sev={str(f.severity) || "minor"}>
                      {str(f.severity) || "—"}
                    </span>
                    {str(f.description) || str(f.type) || "наблюдение"}
                  </li>
                ))}
              </ul>
              {findingsTotal > findings.length ? (
                <div className={styles.popMore}>ещё {findingsTotal - findings.length}…</div>
              ) : null}
            </div>
          ) : null}

          {conditions.length ? (
            <div className={styles.popSection}>
              <div className={styles.popHead}>Условия</div>
              <ul className={styles.popList}>
                {conditions.slice(0, 6).map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {sources.length ? (
            <div className={styles.popSection}>
              <div className={styles.popHead}>Ссылки на нормативы ({sourcesTotal})</div>
              <ul className={styles.popList}>
                {sources.map((s, i) => (
                  <li key={i}>
                    {str(s.document) || "документ"}
                    {str(s.clause) ? `, п. ${str(s.clause)}` : ""}
                    {str(s.version) ? ` (в. ${str(s.version)})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!findings.length && !sources.length && !draft && !verdict ? (
            <div className={styles.popEmpty}>
              Агент не вернул детализированного результата по этому запуску.
            </div>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
