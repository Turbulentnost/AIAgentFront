import { AlertTriangle, CheckCircle2, CircleAlert, OctagonAlert } from "lucide-react";
import type {
  OmtoFinding,
  OmtoQualityStatus,
  OmtoSupportManagerCaseDetail,
  OmtoSupportManagerOutput
} from "@/types/procurement";
import {
  caseTitle,
  formatDateTime,
  OMTO_FIELD_LABELS,
  OMTO_QUALITY_LABELS,
  OMTO_SEVERITY_LABELS
} from "@/utils/procurementDashboard";
import styles from "../ProcurementAgent.module.css";

type Props = {
  detail: OmtoSupportManagerCaseDetail;
};

function outputFrom(detail: OmtoSupportManagerCaseDetail): OmtoSupportManagerOutput | null {
  const latest = detail.latest_result?.output_data;
  const stored = detail.case_metadata?.omto_support_manager_output;
  return latest || stored || null;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function qualityIcon(status: OmtoQualityStatus) {
  if (status === "ok") return CheckCircle2;
  if (status === "incomplete") return CircleAlert;
  return OctagonAlert;
}

function FindingRow({ finding }: { finding: OmtoFinding }) {
  return (
    <li>
      <strong>
        {OMTO_FIELD_LABELS[finding.field] || finding.field}: {finding.message}
      </strong>
      <span>
        {OMTO_SEVERITY_LABELS[finding.severity] || finding.severity}
        {" · "}
        {finding.rule_id}
        {finding.suggested_fix ? ` · исправление: ${finding.suggested_fix}` : ""}
      </span>
      <small>
        Текущее значение: {formatValue(finding.current_value)}
        {finding.source_ref ? ` · источник: ${finding.source_ref}` : ""}
      </small>
    </li>
  );
}

export function OmtoSupportManagerResultPanel({ detail }: Props) {
  const output = outputFrom(detail);
  const findings = output?.findings ?? [];
  const criticalFindings = findings.filter((item) => item.severity === "critical");
  const otherFindings = findings.filter((item) => item.severity !== "critical");
  const actions = output?.actions ?? [];
  const hasDataCheck = actions.includes("DATA_CHECK");
  const QualityIcon = output ? qualityIcon(output.quality_status) : AlertTriangle;

  return (
    <section className={styles.detailsPanel}>
      <div className={styles.panelHeader}>
        <div>
          <h3>{caseTitle(detail)}</h3>
          <p>Проверка обязательных полей и DATA_CHECK</p>
        </div>
        <span className={detail.source_active ? styles.syncBadgeOk : styles.syncBadge}>
          {detail.source_active ? "Основание актуально" : "Основание неактуально"}
        </span>
      </div>

      {!output ? (
        <div className={styles.emptyState}>
          Результат ещё не сформирован. Кейс находится в очереди или ожидает данные.
        </div>
      ) : (
        <div className={styles.resultStatus}>
          <QualityIcon size={16} />
          <div>
            <strong>{output.summary}</strong>
            <span>
              {OMTO_QUALITY_LABELS[output.quality_status] || output.quality_status}
              {hasDataCheck ? " · требуется DATA_CHECK" : ""}
            </span>
          </div>
        </div>
      )}

      <div>
        <h4>Сведения о кейсе</h4>
        <div className={styles.detailGrid}>
          <div>
            <span>Кейс</span>
            <strong>{caseTitle(detail)}</strong>
          </div>
          <div>
            <span>Документ 1С</span>
            <strong>{detail.source_number || detail.source_1c_ref || "—"}</strong>
          </div>
          <div>
            <span>Тип основания</span>
            <strong>{detail.source_type || "—"}</strong>
          </div>
          <div>
            <span>Дата документа</span>
            <strong>{formatDateTime(detail.source_date)}</strong>
          </div>
          <div>
            <span>Статус документа</span>
            <strong>{detail.source_status || "—"}</strong>
          </div>
          <div>
            <span>Подразделение</span>
            <strong>{detail.department_name || "—"}</strong>
          </div>
          <div>
            <span>Склад</span>
            <strong>{detail.warehouse_name || "Не указан"}</strong>
          </div>
          <div>
            <span>Последняя синхронизация</span>
            <strong>{formatDateTime(detail.source_synced_at)}</strong>
          </div>
          <div>
            <span>Проверка выполнена</span>
            <strong>
              {formatDateTime(
                output?.calculated_at || detail.case_metadata?.omto_calculated_at
              )}
            </strong>
          </div>
        </div>
      </div>

      <div>
        <h4>Действия агента</h4>
        {actions.length ? (
          <ul className={styles.resultList}>
            {actions.map((action) => (
              <li key={action}>
                <strong>{action === "DATA_CHECK" ? "DATA_CHECK" : action}</strong>
                <span>
                  {action === "DATA_CHECK"
                    ? "Требуется уточнение обязательных полей"
                    : action === "PASS"
                      ? "Проверка пройдена без замечаний"
                      : "Служебное действие"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.emptyState}>Действия не зафиксированы.</div>
        )}
      </div>

      <div>
        <h4>Проверенные поля</h4>
        {output?.checked_fields?.length ? (
          <div className={styles.detailGrid}>
            {output.checked_fields.map((field) => (
              <div key={field}>
                <span>{OMTO_FIELD_LABELS[field] || field}</span>
                <strong>
                  {findings.some((item) => item.field === field) ? "Замечание" : "OK"}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>Список проверенных полей отсутствует.</div>
        )}
      </div>

      <div className={styles.resultColumns}>
        <div>
          <h4>Критические замечания</h4>
          {criticalFindings.length ? (
            <ul className={styles.resultList}>
              {criticalFindings.map((finding) => (
                <FindingRow
                  finding={finding}
                  key={`${finding.field}-${finding.rule_id}-${finding.source_ref}`}
                />
              ))}
            </ul>
          ) : (
            <div className={styles.emptyState}>Критических замечаний нет.</div>
          )}
        </div>
        <div>
          <h4>Прочие замечания</h4>
          {otherFindings.length ? (
            <ul className={styles.resultList}>
              {otherFindings.map((finding) => (
                <FindingRow
                  finding={finding}
                  key={`${finding.field}-${finding.rule_id}-${finding.source_ref}`}
                />
              ))}
            </ul>
          ) : (
            <div className={styles.emptyState}>Дополнительных замечаний нет.</div>
          )}
        </div>
      </div>

      <div>
        <h4>Черновик запроса уточнения</h4>
        {output?.clarification_draft ? (
          <ul className={styles.missingDataList}>
            {output.clarification_draft.split("\n").filter(Boolean).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <div className={styles.emptyState}>Уточнение не требуется.</div>
        )}
      </div>
    </section>
  );
}
