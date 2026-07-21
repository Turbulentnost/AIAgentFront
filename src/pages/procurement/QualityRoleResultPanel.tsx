import { AlertTriangle, CheckCircle2, CircleAlert, OctagonAlert } from "lucide-react";
import type { QualityFinding, QualityRoleCaseDetail, QualityRoleOutput } from "@/types/procurement";
import { caseTitle, formatDateTime } from "@/utils/procurementDashboard";
import styles from "../ProcurementAgent.module.css";

type Props = {
  detail: QualityRoleCaseDetail;
  agentId: string;
  subtitle: string;
};

function outputFrom(detail: QualityRoleCaseDetail, agentId: string): QualityRoleOutput | null {
  const latest = detail.latest_result?.output_data;
  const stored = detail.case_metadata?.[`${agentId}_output`];
  if (latest) return latest;
  if (stored && typeof stored === "object") return stored as QualityRoleOutput;
  return null;
}

function FindingRow({ finding }: { finding: QualityFinding }) {
  return (
    <li>
      <strong>
        {finding.field}: {finding.message}
      </strong>
      <span>
        {finding.severity} · {finding.rule_id}
        {finding.suggested_fix ? ` · ${finding.suggested_fix}` : ""}
      </span>
    </li>
  );
}

export function QualityRoleResultPanel({ detail, agentId, subtitle }: Props) {
  const output = outputFrom(detail, agentId);
  const findings = output?.findings ?? [];
  const critical = findings.filter((item) => item.severity === "critical");
  const other = findings.filter((item) => item.severity !== "critical");
  const actions = output?.actions ?? [];
  const conditions = output?.execution_conditions ?? [];

  let StatusIcon = CircleAlert;
  if (output?.fitness_status === "fit" || actions.includes("QUALITY_RELEASED")) {
    StatusIcon = CheckCircle2;
  } else if (critical.length || output?.fitness_status === "unfit") {
    StatusIcon = OctagonAlert;
  }

  return (
    <section className={styles.detailsPanel}>
      <div className={styles.panelHeader}>
        <div>
          <h3>{caseTitle(detail)}</h3>
          <p>{subtitle}</p>
        </div>
        <span className={detail.source_active ? styles.syncBadgeOk : styles.syncBadge}>
          {detail.source_active ? "Основание актуально" : "Основание неактуально"}
        </span>
      </div>

      {!output ? (
        <div className={styles.emptyState}>
          Результат ещё не сформирован. Кейс в очереди или ожидает данные.
        </div>
      ) : (
        <div className={styles.resultStatus}>
          <StatusIcon size={16} />
          <div>
            <strong>{output.summary}</strong>
            <span>
              {output.next_status || detail.status}
              {output.next_agent ? ` → ${output.next_agent}` : ""}
            </span>
          </div>
        </div>
      )}

      <div>
        <h4>Сведения</h4>
        <div className={styles.detailGrid}>
          <div>
            <span>Кейс</span>
            <strong>{caseTitle(detail)}</strong>
          </div>
          <div>
            <span>Статус</span>
            <strong>{detail.status}</strong>
          </div>
          <div>
            <span>Категория ТМЦ</span>
            <strong>{output?.category || "—"}</strong>
          </div>
          <div>
            <span>Этап</span>
            <strong>{output?.stage || "—"}</strong>
          </div>
          <div>
            <span>Инженер</span>
            <strong>
              {output?.assigned_engineer_name || output?.assigned_engineer_id || "—"}
            </strong>
          </div>
          <div>
            <span>Акт / ярлык</span>
            <strong>{output?.act_ref || output?.label_ref || "—"}</strong>
          </div>
          <div>
            <span>Резолюция</span>
            <strong>{output?.disposition_label || output?.disposition || "—"}</strong>
          </div>
          <div>
            <span>Расчёт</span>
            <strong>{formatDateTime(output?.calculated_at)}</strong>
          </div>
        </div>
      </div>

      <div>
        <h4>Действия</h4>
        {actions.length ? (
          <ul className={styles.resultList}>
            {actions.map((action) => (
              <li key={action}>
                <strong>{action}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.emptyState}>Действия не зафиксированы.</div>
        )}
      </div>

      {conditions.length ? (
        <div>
          <h4>Условия исполнения</h4>
          <ul className={styles.resultList}>
            {conditions.map((item) => (
              <li key={item}>
                <strong>{item}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.resultColumns}>
        <div>
          <h4>Критические замечания</h4>
          {critical.length ? (
            <ul className={styles.resultList}>
              {critical.map((finding) => (
                <FindingRow
                  finding={finding}
                  key={`${finding.field}-${finding.rule_id}`}
                />
              ))}
            </ul>
          ) : (
            <div className={styles.emptyState}>Критических замечаний нет.</div>
          )}
        </div>
        <div>
          <h4>Прочие замечания</h4>
          {other.length ? (
            <ul className={styles.resultList}>
              {other.map((finding) => (
                <FindingRow
                  finding={finding}
                  key={`${finding.field}-${finding.rule_id}`}
                />
              ))}
            </ul>
          ) : (
            <div className={styles.emptyState}>Дополнительных замечаний нет.</div>
          )}
        </div>
      </div>

      {!output ? null : (
        <div>
          <h4>HITL</h4>
          <div className={styles.warningBox}>
            <AlertTriangle size={16} />
            Черновик У1: подпись человека обязательна. Агент не подменяет физический контроль
            и решения ОТК / ЗДК.
          </div>
        </div>
      )}
    </section>
  );
}
