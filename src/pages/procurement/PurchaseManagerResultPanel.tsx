import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, ShoppingCart } from "lucide-react";
import { usePurchaseManagerAction } from "@/hooks/useProcurementDashboard";
import type {
  PurchaseManagerCaseDetail,
  PurchaseManagerOutput,
  PurchaseManagerPosition,
  PurchaseManagerSupplierOrder
} from "@/types/procurement";
import { caseTitle, formatDate, formatDateTime } from "@/utils/procurementDashboard";
import styles from "../ProcurementAgent.module.css";

type Props = { detail: PurchaseManagerCaseDetail };

function quantity(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString("ru-RU", { maximumFractionDigits: 3 })
    : String(value);
}

function numeric(value?: string | number | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOrder(value: unknown): PurchaseManagerSupplierOrder {
  const order = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    order_id:
      String(
        order.order_id ||
          order.supplier_order_id ||
          order.supplier_order_1c_ref ||
          ""
      ) || null,
    order_number: String(order.order_number || order.supplier_order_number || "Без номера"),
    order_date: (order.order_date as string | null) || null,
    supplier_name: (order.supplier_name as string | null) || null,
    status: (order.status as string | null) || (order.order_status as string | null) || null,
    quantity: (order.quantity as string | number) ?? 0,
    expected_date: (order.expected_date as string | null) || null,
    confirmed: order.confirmed === undefined ? undefined : Boolean(order.confirmed)
  };
}

function outputFrom(detail: PurchaseManagerCaseDetail): PurchaseManagerOutput | null {
  const latest = (detail.latest_result as { output_data?: unknown; agent_id?: string } | null);
  const stored = detail.case_metadata?.purchase_manager_output;
  const candidate =
    (stored && typeof stored === "object" ? stored : null) ||
    (latest?.agent_id === "purchase_manager_agent" &&
    latest.output_data &&
    typeof latest.output_data === "object"
      ? latest.output_data
      : null);
  if (!candidate) return null;
  const raw = candidate as Record<string, unknown>;
  if (!Array.isArray(raw.positions)) return null;
  const positions = raw.positions.map((value) => {
    const position = value as Record<string, unknown>;
    const orders = Array.isArray(position.supplier_orders)
      ? position.supplier_orders.map(parseOrder)
      : [];
    return {
      line_id: String(position.line_id || ""),
      nomenclature_id: String(position.nomenclature_id || "") || undefined,
      nomenclature_name: String(position.nomenclature_name || "Номенклатура"),
      characteristic_name: (position.characteristic_name as string | null) || null,
      unit: String(position.unit || "шт"),
      requested_quantity:
        (position.requested_quantity as string | number) ??
        (position.quantity_to_purchase as string | number) ??
        0,
      ordered_quantity: (position.ordered_quantity as string | number) ?? 0,
      remaining_quantity:
        (position.remaining_quantity as string | number) ??
        (position.uncovered_quantity as string | number) ??
        0,
      is_reconciled:
        position.is_reconciled === undefined
          ? Boolean(position.purchasing)
          : Boolean(position.is_reconciled),
      outcome: String(position.outcome || ""),
      recommendation: String(position.recommendation || ""),
      supplier_orders: orders
    } satisfies PurchaseManagerPosition;
  });
  return {
    schema_version: raw.schema_version as string | undefined,
    calculated_at: raw.calculated_at as string | undefined,
    summary: String(raw.summary || ""),
    recommended_next_step: String(raw.recommended_next_step || ""),
    decision_kind:
      (raw.decision_kind as PurchaseManagerOutput["decision_kind"]) || "none",
    positions,
    missing_data: Array.isArray(raw.missing_data) ? (raw.missing_data as string[]) : [],
    validation_issues: Array.isArray(raw.validation_issues)
      ? (raw.validation_issues as Array<{ code: string; message: string }>)
      : [],
    excluded_capabilities: Array.isArray(raw.excluded_capabilities)
      ? (raw.excluded_capabilities as string[])
      : []
  };
}

export function PurchaseManagerResultPanel({ detail }: Props) {
  const output = useMemo(() => outputFrom(detail), [detail]);
  const confirmMutation = usePurchaseManagerAction("confirm_reconciliation");
  const ackMutation = usePurchaseManagerAction("acknowledge_critical");
  const decisionKind =
    detail.purchase_manager_decision_kind ||
    output?.decision_kind ||
    (detail.case_metadata?.purchase_manager_decision_kind as string | undefined);
  const awaiting =
    detail.purchase_manager_work_status === "awaiting_action" || detail.requires_human_review;
  const totals = useMemo(
    () =>
      (output?.positions || []).reduce(
        (result, position) => ({
          requested: result.requested + numeric(position.requested_quantity),
          ordered: result.ordered + numeric(position.ordered_quantity),
          remaining: result.remaining + numeric(position.remaining_quantity)
        }),
        { requested: 0, ordered: 0, remaining: 0 }
      ),
    [output]
  );
  const issues = [
    ...(output?.missing_data || []),
    ...(output?.validation_issues || []).map((item) => item.message),
    ...(output?.excluded_capabilities || [])
  ];

  return (
    <section className={`${styles.detailsPanel} ${styles.engineerDetailsPanel}`}>
      <div className={styles.engineerPanelHeader}>
        <div>
          <div className={styles.engineerTitleRow}>
            <h3>{caseTitle(detail)}</h3>
          </div>
          <p>Сверка потребности с заказами поставщикам</p>
        </div>
        <div className={styles.lastCalculation}>
          <span>Последняя сверка</span>
          <strong>{formatDateTime(output?.calculated_at)}</strong>
        </div>
      </div>

      {!output ? (
        <div className={styles.emptyState}>
          {detail.purchase_manager_work_status === "processing"
            ? "ИИ-агент сверяет открытые заказы поставщикам..."
            : "Результат сверки ещё не получен."}
        </div>
      ) : (
        <>
          <div className={`${styles.resultStatus} ${issues.length ? styles.resultStatusWarning : ""}`}>
            {issues.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <div>
              <strong>{output.summary}</strong>
              <span>{output.recommended_next_step}</span>
            </div>
          </div>

          {awaiting && decisionKind === "reconciliation_confirmation" ? (
            <div className={styles.engineerActionBar}>
              <div>
                <strong>Сверка ожидает подтверждения</strong>
                <span>Подтвердите сопоставление потребности с заказами поставщикам.</span>
              </div>
              <button
                className={styles.primaryAction}
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate(detail.id)}
                type="button"
              >
                <CheckCircle2 size={16} />
                {confirmMutation.isPending ? "Подтверждение..." : "Подтвердить сверку"}
              </button>
            </div>
          ) : null}

          {awaiting && decisionKind === "critical_acknowledgement" ? (
            <div className={styles.engineerActionBar}>
              <div>
                <CircleAlert size={16} /> Недостаточно данных для сверки
              </div>
              <button
                className={styles.secondaryAction}
                disabled={ackMutation.isPending}
                onClick={() => ackMutation.mutate(detail.id)}
                type="button"
              >
                Ознакомлен
              </button>
            </div>
          ) : null}

          <div className={styles.engineerMetrics}>
            <div><span>Потребность</span><strong>{quantity(totals.requested)}</strong></div>
            <div><span>В заказах</span><strong className={styles.metricCovered}>{quantity(totals.ordered)}</strong></div>
            <div><span>Не покрыто</span><strong className={totals.remaining > 0 ? styles.metricDeficit : styles.metricCovered}>{quantity(totals.remaining)}</strong></div>
          </div>

          <div className={styles.engineerTabContent}>
            <div className={styles.sectionHeading}>
              <div>
                <h4>Сверка по позициям</h4>
                <p>Заказы поставщикам, покрывающие заявленную потребность.</p>
              </div>
            </div>
            <div className={styles.purchaseManagerList}>
              {output.positions.map((position) => (
                <article className={styles.purchaseManagerPosition} key={position.line_id}>
                  <div className={styles.purchaseManagerPositionHeader}>
                    <div>
                      <strong>{position.nomenclature_name}</strong>
                      <small>{position.characteristic_name || position.unit}</small>
                    </div>
                    <span className={styles.outcomeBadge} data-tone={position.is_reconciled ? "success" : "warning"}>
                      {position.is_reconciled ? "Сверено" : "Есть непокрытая потребность"}
                    </span>
                  </div>
                  <div className={styles.detailMetricRow}>
                    <div><span>Потребность</span><strong>{quantity(position.requested_quantity)} {position.unit}</strong></div>
                    <div><span>Заказано</span><strong>{quantity(position.ordered_quantity)} {position.unit}</strong></div>
                    <div><span>Осталось</span><strong>{quantity(position.remaining_quantity)} {position.unit}</strong></div>
                  </div>
                  {position.supplier_orders.length ? (
                    <div className={styles.supplierOrderList}>
                      {position.supplier_orders.map((order, index) => (
                        <div key={`${order.order_id || order.order_number}-${index}`}>
                          <ShoppingCart size={15} />
                          <span>
                            <strong>Заказ поставщику № {order.order_number}</strong>
                            <small>
                              {[order.supplier_name, order.status, order.expected_date ? `ожидается ${formatDate(order.expected_date)}` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          </span>
                          <b>{quantity(order.quantity)} {position.unit}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.warningBox}>Заказы поставщикам не найдены.</div>
                  )}
                  {position.recommendation ? <p className={styles.resultSummary}>{position.recommendation}</p> : null}
                </article>
              ))}
            </div>
            {issues.length ? (
              <div className={styles.warningBox}>
                <AlertTriangle size={16} />
                <ul>{issues.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
