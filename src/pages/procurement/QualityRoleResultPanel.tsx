import { AlertTriangle, CheckCircle2, CircleAlert, OctagonAlert } from "lucide-react";
import type {
  QualityFinding,
  QualityRoleCaseDetail,
  QualityRoleOutput,
  QualitySampleRule
} from "@/types/procurement";
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

function asSampleRule(value: unknown): QualitySampleRule | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<QualitySampleRule>;
  if (!item.rule_id && !item.sample_note && item.sample_size == null) return null;
  return item as QualitySampleRule;
}

function resolveSampleRule(output: QualityRoleOutput | null): QualitySampleRule | null {
  if (!output) return null;
  return (
    asSampleRule(output.sample_rule) ||
    asSampleRule(output.quality_control?.sample_rule) ||
    asSampleRule(output.draft_artifacts?.control_program)
  );
}

function sampleBasisLabel(basis?: string | null) {
  switch (basis) {
    case "3pct":
      return "3% партии";
    case "5pct":
      return "5% партии";
    case "10pct":
      return "10% партии";
    case "15pct":
      return "15% партии";
    case "20pct":
      return "20% партии";
    case "30pct":
      return "30% партии";
    case "50pct":
      return "50% партии";
    case "100pct":
      return "100% партии";
    case "1pct_rating":
      return "1% (макс. рейтинг поставщика)";
    case "per_package":
      return "из каждой тары / коробки";
    case "second_sample":
      return "вторая выборка";
    default:
      return basis || "по категории";
  }
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
  const sample = resolveSampleRule(output);
  const qc = output?.quality_control;
  const scrap = output?.draft_artifacts?.scrap_decision;
  const presentationRef =
    sample?.presentation_ref ||
    (typeof qc?.presentation_ref === "string" ? qc.presentation_ref : null) ||
    (typeof output?.draft_artifacts?.presentation_ref === "string"
      ? output.draft_artifacts.presentation_ref
      : null);
  const nomenclatureRef =
    sample?.nomenclature_ref ||
    (typeof qc?.nomenclature_ref === "string" ? qc.nomenclature_ref : null);
  const supplierRef =
    sample?.supplier_ref || (typeof qc?.supplier_ref === "string" ? qc.supplier_ref : null);
  const lotQty =
    sample?.lot_qty ??
    (typeof output?.draft_artifacts?.lot_qty === "number" ? output.draft_artifacts.lot_qty : null);

  let StatusIcon = CircleAlert;
  if (output?.fitness_status === "fit" || actions.includes("QUALITY_RELEASED")) {
    StatusIcon = CheckCircle2;
  } else if (critical.length || output?.fitness_status === "unfit") {
    StatusIcon = OctagonAlert;
  }

  const sampleVolumeLabel =
    sample?.sample_basis === "per_package"
      ? "из каждой тары"
      : sample?.sample_size != null
        ? `${sample.sample_size} шт.`
        : "— (нужен объём партии)";

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
            <span>Поставка / предъявление</span>
            <strong>{presentationRef || "—"}</strong>
          </div>
          <div>
            <span>Номенклатура</span>
            <strong>{nomenclatureRef || "—"}</strong>
          </div>
          <div>
            <span>Поставщик</span>
            <strong>{supplierRef || "—"}</strong>
          </div>
          <div>
            <span>Объём партии</span>
            <strong>{lotQty != null ? `${lotQty} шт.` : "—"}</strong>
          </div>
          <div>
            <span>Категория ТМЦ</span>
            <strong>{output?.category || sample?.category || "—"}</strong>
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
        <h4>Программа и выборка</h4>
        {sample ? (
          <div className={styles.detailGrid}>
            <div>
              <span>Правило</span>
              <strong>{sample.rule_id || "—"}</strong>
            </div>
            <div>
              <span>Алгоритм</span>
              <strong>{sampleBasisLabel(sample.sample_basis)}</strong>
            </div>
            <div>
              <span>Объём выборки</span>
              <strong>{sampleVolumeLabel}</strong>
            </div>
            <div>
              <span>Доля выборки</span>
              <strong>{sample.sample_pct != null ? `${sample.sample_pct}%` : "—"}</strong>
            </div>
            <div>
              <span>Порог брака</span>
              <strong>
                {sample.scrap_threshold_pct != null ? `${sample.scrap_threshold_pct}%` : "15%"}
              </strong>
            </div>
            <div>
              <span>Вторая выборка</span>
              <strong>
                {sample.require_second_sample
                  ? sample.second_sample_size != null
                    ? `да · ${sample.second_sample_size} шт.`
                    : "да"
                  : "нет"}
              </strong>
            </div>
            <div>
              <span>Рейтинг поставщика</span>
              <strong>
                {sample.supplier_quality_rating != null && sample.supplier_quality_rating !== ""
                  ? String(sample.supplier_quality_rating)
                  : "—"}
              </strong>
            </div>
            <div>
              <span>Решение по браку</span>
              <strong>
                {typeof scrap?.message === "string"
                  ? scrap.message
                  : typeof scrap?.rule_id === "string"
                    ? scrap.rule_id
                    : "—"}
              </strong>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            Программа выборки ещё не рассчитана для этой поставки.
          </div>
        )}
        {sample?.sample_note ? (
          <div className={styles.warningBox} style={{ marginTop: 10 }}>
            <AlertTriangle size={16} />
            {sample.sample_note}
          </div>
        ) : null}
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
