import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";
import type {
  ProductionDispatcherCaseDetail,
  ProductionDispatcherOutput,
  ProductionDispatcherPosition
} from "@/types/procurement";
import { useProductionDispatcherAction } from "@/hooks/useProcurementDashboard";
import { caseTitle, formatDate, formatDateTime } from "@/utils/procurementDashboard";
import styles from "../ProcurementAgent.module.css";

type Props = {
  detail: ProductionDispatcherCaseDetail;
};

function quantity(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString("ru-RU", { maximumFractionDigits: 3 })
    : String(value);
}

function outputFrom(detail: ProductionDispatcherCaseDetail): ProductionDispatcherOutput | null {
  const latest = (detail.latest_result as { output_data?: unknown } | null | undefined)
    ?.output_data;
  const stored = detail.case_metadata?.production_dispatcher_output;
  const candidate = stored || latest;
  if (!candidate || typeof candidate !== "object") return null;
  const raw = candidate as Record<string, unknown>;
  if (!Array.isArray(raw.positions)) return null;
  return {
    ...raw,
    positions: raw.positions as ProductionDispatcherPosition[],
    summary: String(raw.summary || ""),
    recommended_next_step: String(raw.recommended_next_step || ""),
    decision_kind: (raw.decision_kind as ProductionDispatcherOutput["decision_kind"]) || "none",
    missing_data: Array.isArray(raw.missing_data) ? (raw.missing_data as string[]) : [],
    validation_issues: Array.isArray(raw.validation_issues)
      ? (raw.validation_issues as Array<{ code: string; message: string }>)
      : [],
    excluded_capabilities: Array.isArray(raw.excluded_capabilities)
      ? (raw.excluded_capabilities as string[])
      : []
  };
}

const URGENCY_LABELS: Record<string, string> = {
  normal: "Обычная",
  high: "Высокая",
  critical: "Критическая"
};

const OUTCOME_LABELS: Record<string, string> = {
  reserve_stock: "Резервирование остатка",
  transfer_proposed: "Предложение перемещения",
  link_incoming: "Привязка поступления",
  procurement_required: "Требуется закупка",
  critical_shortage: "Критический дефицит",
  already_covered: "Уже обеспечено",
  fully_covered: "Полностью покрыто"
};

export function ProductionDispatcherResultPanel({ detail }: Props) {
  const output = useMemo(() => outputFrom(detail), [detail]);
  const confirmMutation = useProductionDispatcherAction("confirm_supply");
  const ackMutation = useProductionDispatcherAction("acknowledge_critical");
  const [selectedMethod, setSelectedMethod] = useState("procurement");

  const decisionKind =
    detail.dispatcher_decision_kind ||
    output?.decision_kind ||
    (detail.case_metadata?.dispatcher_decision_kind as string | undefined);
  const awaiting =
    detail.dispatcher_work_status === "awaiting_action" || detail.requires_human_review;

  const primaryMethods = useMemo(() => {
    const methods = new Map<string, string>();
    for (const position of output?.positions || []) {
      for (const item of position.recommendations || []) {
        if (item.method && item.method !== "none") {
          methods.set(item.method, item.label);
        }
      }
    }
    if (!methods.size) methods.set("procurement", "Закупка");
    return [...methods.entries()];
  }, [output]);

  return (
    <section className={styles.detailsPanel}>
      <div className={styles.engineerPanelHeader}>
        <div>
          <div className={styles.engineerTitleRow}>
            <h3>{caseTitle(detail)}</h3>
          </div>
          <p>
            {detail.dispatcher_stream === "after_engineer"
              ? "После инженера СПП"
              : "Точка заказа"}
            {detail.source_date ? ` · ${formatDate(detail.source_date)}` : ""}
          </p>
        </div>
        {output?.calculated_at ? (
          <div className={styles.lastCalculation}>
            Расчёт: {formatDateTime(output.calculated_at)}
          </div>
        ) : null}
      </div>

      {!output ? (
        <div className={styles.emptyState}>
          {detail.dispatcher_work_status === "processing"
            ? "ИИ-агент выполняет расчёт..."
            : "Результат расчёта ещё не получен."}
        </div>
      ) : (
        <>
          <div className={styles.engineerSectionCard}>
            <strong>{output.summary}</strong>
            <p>{output.recommended_next_step}</p>
          </div>

          {awaiting && decisionKind === "supply_confirmation" ? (
            <div className={styles.engineerActionBar}>
              <div>
                <CircleAlert size={16} /> Требуется подтвердить способ обеспечения
              </div>
              <div className={styles.engineerFacts}>
                {primaryMethods.map(([method, label]) => (
                  <label key={method}>
                    <input
                      checked={selectedMethod === method}
                      name="supply-method"
                      onChange={() => setSelectedMethod(method)}
                      type="radio"
                    />{" "}
                    {label}
                  </label>
                ))}
              </div>
              <button
                className={styles.primaryAction}
                disabled={confirmMutation.isPending}
                onClick={() =>
                  confirmMutation.mutate({
                    caseId: detail.id,
                    method: selectedMethod
                  })
                }
                type="button"
              >
                <CheckCircle2 size={16} /> Подтвердить
              </button>
            </div>
          ) : null}

          {awaiting && decisionKind === "critical_acknowledgement" ? (
            <div className={styles.engineerActionBar}>
              <div>
                <AlertTriangle size={16} /> Критическая ошибка данных. Ознакомьтесь с проблемой.
              </div>
              <button
                className={styles.secondaryAction}
                disabled={ackMutation.isPending}
                onClick={() => ackMutation.mutate({ caseId: detail.id })}
                type="button"
              >
                Ознакомлен
              </button>
            </div>
          ) : null}

          <div className={styles.calculationTable}>
            <div className={styles.calculationHeader}>
              <span>Номенклатура</span>
              <span>Своб. остаток</span>
              <span>Ожидаемые</span>
              <span>Min / Max</span>
              <span>К-т</span>
              <span>Дефицит</span>
              <span>Срочность</span>
              <span>Рекомендация</span>
            </div>
            {output.positions.map((position) => (
              <div className={styles.calculationItem} key={position.line_id}>
                <div className={styles.calculationRow}>
                  <span className={styles.rowNomenclature}>
                    <strong>{position.nomenclature_name}</strong>
                    <small>{position.unit}</small>
                  </span>
                  <span>{quantity(position.free_stock)}</span>
                  <span>
                    {quantity(position.expected_total)}
                    <small>
                      путь {quantity(position.expected_in_transit)} / работа{" "}
                      {quantity(position.expected_in_progress)}
                    </small>
                  </span>
                  <span>
                    {quantity(position.minimum_stock)} / {quantity(position.maximum_stock)}
                  </span>
                  <span>{quantity(position.stock_growth_coefficient)}</span>
                  <span>{quantity(position.net_deficit)}</span>
                  <span>{URGENCY_LABELS[position.urgency] || position.urgency}</span>
                  <span className={styles.outcomeBadge}>
                    {OUTCOME_LABELS[position.outcome] || position.outcome}
                  </span>
                </div>
                {position.formulas ? (
                  <div className={styles.calculationDetails}>
                    <div className={styles.formulaRow}>
                      {Object.values(position.formulas).map((value) => (
                        <span key={value}>{value}</span>
                      ))}
                    </div>
                    <p>{position.recommendation}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {(output.missing_data?.length ||
            output.validation_issues?.length ||
            output.excluded_capabilities?.length) ? (
            <div className={styles.warningBox}>
              <AlertTriangle size={16} />
              <ul>
                {(output.missing_data || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
                {(output.validation_issues || []).map((item) => (
                  <li key={`${item.code}-${item.message}`}>{item.message}</li>
                ))}
                {(output.excluded_capabilities || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
