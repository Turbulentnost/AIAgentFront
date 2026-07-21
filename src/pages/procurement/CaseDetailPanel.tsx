import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  PackageCheck,
  ShoppingCart
} from "lucide-react";
import { useProductionPreparationEngineerAction } from "@/hooks/useProcurementDashboard";
import type {
  ProcurementCaseDetail,
  ProcurementRouteStage,
  ProductionPreparationEngineerOutput,
  ProductionPreparationPositionCalculation
} from "@/types/procurement";
import {
  caseTitle,
  formatDate,
  formatDateTime,
  formatQuantity,
  sourceActiveLabel,
  AGENT_WAIT_LABELS,
  STATUS_LABELS
} from "@/utils/procurementDashboard";
import { AgentTimeline } from "./AgentTimeline";
import { RouteStagesBar } from "./RouteStagesBar";
import styles from "../ProcurementAgent.module.css";

type Props = {
  detail: ProcurementCaseDetail;
  sourceLabel: string;
  mode: "bases" | "cases";
};

const OUTCOME_LABELS: Record<string, string> = {
  fully_covered: "К обеспечению",
  transfer_required: "Требуется перемещение",
  partially_covered: "Обеспечено частично",
  covered_by_open_order: "Покрыто заказом",
  procurement_required: "Требуется закупка",
  critical_shortage: "Критический дефицит",
  clarification_required: "Требуется уточнение"
};

const STAGE_LABELS: Record<string, string> = {
  basis: "Основание",
  data: "Данные",
  coverage: "Обеспечение",
  purchase: "Закупка",
  payment: "Оплата",
  delivery: "Поставка",
  receipt: "Оприходование",
  chief_dispatcher: "Главный диспетчер"
};

function numeric(value?: string | number | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function quantity(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString("ru-RU", { maximumFractionDigits: 3 })
    : String(value);
}

function engineerOutput(detail: ProcurementCaseDetail): ProductionPreparationEngineerOutput | null {
  const stored = detail.case_metadata?.production_preparation_engineer_output;
  const latest = detail.latest_result?.output_data;
  const candidate = stored || latest;
  if (!candidate || typeof candidate !== "object") return null;
  const raw = candidate as Record<string, unknown>;
  if (!Array.isArray(raw.positions)) return null;
  return {
    ...raw,
    positions: raw.positions as ProductionPreparationPositionCalculation[],
    specifications: Array.isArray(raw.specifications) ? raw.specifications : [],
    validation_issues: Array.isArray(raw.validation_issues) ? raw.validation_issues : [],
    missing_data: Array.isArray(raw.missing_data) ? raw.missing_data : [],
    excluded_capabilities: Array.isArray(raw.excluded_capabilities)
      ? raw.excluded_capabilities
      : []
  } as ProductionPreparationEngineerOutput;
}

export function CaseDetailPanel({ detail, sourceLabel, mode }: Props) {
  const currentState = detail.current_state;
  const output = engineerOutput(detail);
  const calculatedPositions = output?.positions ?? [];
  const confirmPurchase = useProductionPreparationEngineerAction("confirm_purchase");
  const [showExplanation, setShowExplanation] = useState(false);
  const [expandedDataRows, setExpandedDataRows] = useState<Set<string>>(new Set());
  const routeStages = useMemo<ProcurementRouteStage[]>(() => {
    const stages = detail.route_stages || [];
    const controlPoint = currentState?.control_point || detail.control_point;
    const dispatcherRelevant =
      controlPoint === "chief_dispatcher" ||
      currentState?.current_agent_id === "production_dispatcher_agent" ||
      detail.current_agent_id === "production_dispatcher_agent" ||
      stages.some((stage) => stage.stage_id === "chief_dispatcher");
    if (!dispatcherRelevant || stages.some((stage) => stage.stage_id === "chief_dispatcher")) {
      return stages;
    }

    const result: ProcurementRouteStage[] = [];
    stages.forEach((stage) => {
      result.push({ ...stage });
      if (stage.stage_id === "coverage") {
        result.push({
          stage_id: "chief_dispatcher",
          label: "Главный диспетчер",
          order: stage.order + 1,
          status: controlPoint === "chief_dispatcher" ? "running" : "completed",
          summary: "Результат обеспечения передан главному диспетчеру."
        });
      }
    });
    return result.map((stage, index) => {
      if (controlPoint !== "chief_dispatcher") return { ...stage, order: index + 1 };
      if (["basis", "data", "coverage"].includes(stage.stage_id)) {
        return { ...stage, order: index + 1, status: "completed" };
      }
      if (stage.stage_id === "chief_dispatcher") {
        return { ...stage, order: index + 1, status: "running" };
      }
      return { ...stage, order: index + 1, status: "pending" };
    });
  }, [
    currentState?.control_point,
    currentState?.current_agent_id,
    detail.control_point,
    detail.current_agent_id,
    detail.route_stages
  ]);
  const defaultStage =
    routeStages.find((stage) => stage.status === "running")?.stage_id ||
    (output ? "coverage" : detail.route_stages[0]?.stage_id) ||
    "basis";
  const [selectedStage, setSelectedStage] = useState(defaultStage);

  useEffect(() => {
    setSelectedStage(
      routeStages.find((stage) => stage.status === "running")?.stage_id ||
        (engineerOutput(detail) ? "coverage" : routeStages[0]?.stage_id) ||
        "basis"
    );
    setShowExplanation(false);
    setExpandedDataRows(new Set());
  }, [detail.id, routeStages]);

  const totals = useMemo(
    () =>
      calculatedPositions.reduce(
        (acc, position) => ({
          gross: acc.gross + numeric(position.gross_requirement),
          covered: acc.covered + numeric(position.total_available_supply),
          deficit: acc.deficit + numeric(position.net_requirement)
        }),
        { gross: 0, covered: 0, deficit: 0 }
      ),
    [calculatedPositions]
  );
  const primaryUnit =
    calculatedPositions.length > 0 &&
    calculatedPositions.every((position) => position.unit === calculatedPositions[0].unit)
      ? calculatedPositions[0].unit
      : "";
  const needsPurchase =
    detail.engineer_decision_kind === "purchase_confirmation" && detail.engineer_work_status !== "archived";
  const resultSuccessful = Boolean(output) && totals.deficit === 0;
  const selectedStageData = routeStages.find((stage) => stage.stage_id === selectedStage);
  const nextStage = routeStages.find(
    (stage) => stage.order === (selectedStageData?.order ?? 0) + 1
  );

  const toggleDataRow = (lineId: string) => {
    setExpandedDataRows((current) => {
      const next = new Set(current);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  return (
    <section className={`${styles.detailsPanel} ${mode === "cases" ? styles.orchestratorDetails : ""}`}>
      <div className={styles.orchestratorCaseHeader}>
        <div>
          <div className={styles.engineerTitleRow}>
            <h3>{caseTitle(detail)}</h3>
            <span className={detail.source_active ? styles.syncBadgeOk : styles.syncBadge}>
              {sourceActiveLabel(detail)}
            </span>
            {detail.engineer_bucket ? (
              <span className={styles.orchestratorStatusBadge} data-status={detail.engineer_bucket}>
                {detail.engineer_bucket === "success"
                  ? "Успешный"
                  : detail.engineer_bucket === "critical"
                    ? "Критический"
                    : "Требует внимания"}
              </span>
            ) : null}
          </div>
          <p>{sourceLabel}</p>
        </div>
        <div className={styles.lastCalculation}>
          <span>Состояние оркестратора</span>
          <strong>{STATUS_LABELS[detail.status] ?? detail.status}</strong>
        </div>
      </div>

      {mode === "bases" ? <div className={styles.detailGrid}>
        <div>
          <span>Текущий статус</span>
          <strong>{STATUS_LABELS[detail.status] ?? detail.status}</strong>
        </div>
        <div>
          <span>Исполнитель</span>
          <strong>
            {currentState?.current_agent_label ||
              detail.current_agent_name ||
              "Оркестратор закупок"}
          </strong>
        </div>
        {currentState?.wait_status ? (
          <div>
            <span>Состояние агента</span>
            <strong>
              {AGENT_WAIT_LABELS[currentState.wait_status] || currentState.wait_status}
            </strong>
          </div>
        ) : null}
        <div>
          <span>Основание</span>
          <strong>{sourceLabel}</strong>
        </div>
        {detail.source_type === "reorder_point" ? (
          <div>
            <span>Основание точки заказа</span>
            <strong>
              {detail.source_basis_number
                ? `№ ${detail.source_basis_number}`
                : detail.source_basis_1c_ref || "Не указано"}
            </strong>
            {detail.source_basis_date || detail.source_basis_status ? (
              <small>
                {[formatDateTime(detail.source_basis_date), detail.source_basis_status]
                  .filter((value) => value && value !== "—")
                  .join(" · ")}
              </small>
            ) : null}
          </div>
        ) : null}
        <div>
          <span>Номер документа</span>
          <strong>{detail.source_number || "—"}</strong>
        </div>
        <div>
          <span>Дата документа</span>
          <strong>{formatDateTime(detail.source_date)}</strong>
        </div>
        <div>
          <span>Статус документа 1С</span>
          <strong>{detail.source_status || "—"}</strong>
        </div>
        <div>
          <span>Последняя синхронизация с 1С</span>
          <strong>{formatDateTime(detail.source_synced_at)}</strong>
        </div>
        <div>
          <span>Инициатор</span>
          <strong>{detail.initiator_name || "Название не получено"}</strong>
        </div>
        <div>
          <span>Подразделение</span>
          <strong>{detail.department_name || "Название не получено"}</strong>
        </div>
        <div>
          <span>Склад</span>
          <strong>{detail.warehouse_name || "Название не получено"}</strong>
        </div>
        <div>
          <span>Общая желаемая дата поставки</span>
          <strong>{formatDate(detail.required_date)}</strong>
        </div>
        {detail.closed_reason_label ? (
          <div>
            <span>Причина архива</span>
            <strong>{detail.closed_reason_label}</strong>
          </div>
        ) : null}
      </div> : null}

      {mode === "cases" ? (
        <>
          <RouteStagesBar
            onSelect={setSelectedStage}
            selectedStageId={selectedStage}
            stages={routeStages}
          />

          {selectedStage === "data" ? (
            <div className={styles.orchestratorDataTable}>
              <div className={styles.sectionHeading}>
                <div>
                  <h4>Расчёт по позициям</h4>
                  <p>Основные показатели расчёта потребности и обеспеченности ТМЦ.</p>
                </div>
                <span className={styles.syncBadge}>
                  {output ? calculatedPositions.length : detail.positions.length} позиций
                </span>
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Номенклатура</th>
                      <th>Заказ / этап</th>
                      <th>Потребность</th>
                      <th>Обеспечено</th>
                      <th>Дефицит</th>
                      <th>Требуемая дата</th>
                      <th>Решение</th>
                    </tr>
                  </thead>
                  <tbody>
                    {output
                      ? calculatedPositions.map((position) => {
                          const expanded = expandedDataRows.has(position.line_id);
                          return [
                            <tr key={position.line_id}>
                              <td>
                                <button
                                  aria-expanded={expanded}
                                  className={styles.tableExpandButton}
                                  onClick={() => toggleDataRow(position.line_id)}
                                  type="button"
                                >
                                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                <strong>{position.nomenclature_name}</strong>
                                <small>{position.characteristic_name || "Без характеристики"}</small>
                              </td>
                              <td><strong>{position.production_order || "Главная потребность"}</strong><small>{position.production_stage || "Этап не указан"}</small></td>
                              <td>{quantity(position.gross_requirement)} {position.unit}</td>
                              <td className={styles.metricCovered}>{quantity(position.total_available_supply)} {position.unit}</td>
                              <td className={numeric(position.net_requirement) > 0 ? styles.metricDeficit : ""}>{quantity(position.net_requirement)} {position.unit}</td>
                              <td>{formatDate(position.required_date)}</td>
                              <td><span className={styles.outcomeBadge} data-tone={numeric(position.net_requirement) > 0 ? "warning" : "success"}>{OUTCOME_LABELS[position.outcome] || position.outcome}</span></td>
                            </tr>,
                            expanded ? (
                              <tr className={styles.tableCalculationDetails} key={`${position.line_id}-details`}>
                                <td colSpan={7}>
                                  <div>
                                    <span>Количество изделий: <strong>{quantity(position.product_quantity)}</strong></span>
                                    <span>Норма расхода: <strong>{quantity(position.consumption_rate)} {position.unit}</strong></span>
                                    <span>Технологические потери: <strong>{quantity(position.technological_loss_percent)}%</strong></span>
                                    <span>Свободный остаток: <strong>{quantity(position.free_stock)} {position.unit}</strong></span>
                                  </div>
                                  <p>{position.recommendation}</p>
                                </td>
                              </tr>
                            ) : null
                          ];
                        })
                      : detail.positions.map((position) => (
                          <tr key={position.id}>
                            <td><strong>{position.nomenclature_name || "Название не получено"}</strong></td>
                            <td>Главная потребность</td>
                            <td>{formatQuantity(position.quantity)} {position.unit || ""}</td>
                            <td>—</td>
                            <td>—</td>
                            <td>{formatDate(position.required_date || detail.required_date)}</td>
                            <td>{position.supply_action || "Ожидает расчёта"}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : selectedStage === "coverage" && output ? (
            <div
              className={styles.orchestratorResultCard}
              data-tone={needsPurchase ? "warning" : resultSuccessful ? "success" : "neutral"}
            >
              <div className={styles.orchestratorResultHeading}>
                <div className={styles.orchestratorResultIcon}>
                  {needsPurchase ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                </div>
                <div>
                  <span>Результат ролевого агента</span>
                  <h4>{needsPurchase ? "Для продолжения требуется подтверждение" : output.summary}</h4>
                  <p>
                    {needsPurchase
                      ? "Обнаружен дефицит. Агент рекомендует подтвердить создание закупки."
                      : output.recommended_next_step}
                  </p>
                </div>
              </div>

              <div className={styles.orchestratorResultMetrics}>
                <div><span>Потребность</span><strong>{quantity(totals.gross)} {primaryUnit}</strong></div>
                <div><span>Обеспечено</span><strong>{quantity(totals.covered)} {primaryUnit}</strong></div>
                <div><span>Дефицит</span><strong data-deficit={totals.deficit > 0}>{quantity(totals.deficit)} {primaryUnit}</strong></div>
                <div><span>Проблемы данных</span><strong>{output.validation_issues.length + output.missing_data.length}</strong></div>
              </div>

              <div className={styles.orchestratorResultFooter}>
                <div>
                  <PackageCheck size={15} />
                  <span>ИИ-агент закупок и логистики</span>
                  <Clock3 size={14} />
                  <strong>{formatDateTime(output.calculated_at)}</strong>
                </div>
                {needsPurchase ? (
                  <div className={styles.orchestratorResultActions}>
                    <button
                      className={styles.secondaryAction}
                      onClick={() => setShowExplanation((value) => !value)}
                      type="button"
                    >
                      {showExplanation ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      {showExplanation ? "Скрыть пояснение" : "Открыть пояснение"}
                    </button>
                    <button
                      className={styles.primaryAction}
                      disabled={confirmPurchase.isPending}
                      onClick={() => confirmPurchase.mutate(detail.id)}
                      type="button"
                    >
                      <ShoppingCart size={15} />
                      {confirmPurchase.isPending ? "Подтверждение..." : "Подтвердить закупку"}
                    </button>
                  </div>
                ) : (
                  <span className={styles.confirmedBadge}><CheckCircle2 size={14} /> Решение принято оркестратором</span>
                )}
              </div>

              {showExplanation ? (
                <div className={styles.orchestratorExplanation}>
                  {calculatedPositions
                    .filter((position) => numeric(position.net_requirement) > 0)
                    .map((position) => (
                      <div key={position.line_id}>
                        <strong>{position.nomenclature_name}</strong>
                        <span>Дефицит {quantity(position.net_requirement)} {position.unit}</span>
                        <p>{position.recommendation}</p>
                      </div>
                    ))}
                </div>
              ) : null}

              {confirmPurchase.isError ? (
                <div className={styles.documentSearchMessage}>
                  Не удалось подтвердить закупку. Обновите кейс и повторите попытку.
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.orchestratorStageSummary}>
              <div>
                <span>Выбранный этап</span>
                <strong>{selectedStageData?.label || STAGE_LABELS[selectedStage] || selectedStage}</strong>
                <p>
                  {selectedStageData?.summary ||
                    (selectedStageData?.status === "completed"
                      ? "Этап успешно завершён."
                      : selectedStageData?.status === "running"
                        ? "Этап выполняется оркестратором."
                        : "Этап ещё не начат.")}
                </p>
              </div>
              <span className={styles.orchestratorStatusBadge} data-status={selectedStageData?.status}>
                {selectedStageData?.status === "completed"
                  ? "Завершён"
                  : selectedStageData?.status === "running"
                    ? "В работе"
                    : "Ожидает"}
              </span>
            </div>
          )}

          <div className={styles.caseBodySplit}>
            <div className={styles.orchestratorTimelineCard}>
              <div className={styles.sectionHeading}>
                <div><h4>Ход кейса</h4><p>Ключевые события выбранного маршрута</p></div>
                <span className={styles.syncBadge}>{detail.timeline.length} событий</span>
              </div>
              <AgentTimeline entries={detail.timeline || []} />
            </div>
            <aside className={`${styles.stateCard} ${styles.orchestratorDecisionCard}`}>
              <div className={styles.sectionHeading}>
                <div><h4>Решение оркестратора</h4><p>Текущее состояние перехода</p></div>
                {needsPurchase ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
              </div>
              <div>
                <span>Этап</span>
                <strong>{STAGE_LABELS[currentState?.control_point || detail.control_point || "basis"] || currentState?.control_point || detail.control_point}</strong>
              </div>
              <div>
                <span>Состояние агента</span>
                <strong>{STATUS_LABELS[detail.status] ?? detail.status}</strong>
              </div>
              {currentState?.task_status ? (
                <div>
                  <span>Статус задачи агента</span>
                  <strong>
                    {AGENT_WAIT_LABELS[currentState.wait_status || ""] ||
                      currentState.task_status}
                  </strong>
                </div>
              ) : null}
              <div>
                <span>Результат</span>
                <strong className={needsPurchase ? styles.metricDeficit : styles.metricCovered}>
                  {needsPurchase ? "Требует внимания" : resultSuccessful ? "Успешный" : "В работе"}
                </strong>
              </div>
              <div><span>Решение пользователя</span><strong>{needsPurchase ? "Ожидается" : "Подтверждено"}</strong></div>
              <div><span>Следующий этап</span><strong>{nextStage?.label || "Определяется оркестратором"}</strong></div>
              <p>{currentState?.wait_reason || currentState?.summary || detail.summary}</p>
            </aside>
          </div>
        </>
      ) : null}

      {mode === "bases" ? <div className={styles.orchestratorPositions}>
        <div className={styles.sectionHeading}>
          <div><h4>Позиции ТМЦ</h4><p>{output ? "Результат этапа «Обеспечение»" : "Позиции документа 1С"}</p></div>
          <span className={styles.syncBadge}>{output ? calculatedPositions.length : detail.positions.length} позиций</span>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Номенклатура</th>
                <th>Потребность</th>
                <th>Обеспечено</th>
                <th>Дефицит</th>
                <th>Решение агента</th>
              </tr>
            </thead>
            <tbody>
              {output
                ? calculatedPositions.map((position, index) => (
                    <tr key={position.line_id}>
                      <td>{index + 1}</td>
                      <td><strong>{position.nomenclature_name}</strong><small>{position.characteristic_name || "Без характеристики"}</small></td>
                      <td>{quantity(position.gross_requirement)} {position.unit}</td>
                      <td className={styles.metricCovered}>{quantity(position.total_available_supply)} {position.unit}</td>
                      <td className={numeric(position.net_requirement) > 0 ? styles.metricDeficit : ""}>{quantity(position.net_requirement)} {position.unit}</td>
                      <td><span className={styles.outcomeBadge} data-tone={numeric(position.net_requirement) > 0 ? "warning" : "success"}>{OUTCOME_LABELS[position.outcome] || position.outcome}</span></td>
                    </tr>
                  ))
                : detail.positions.map((position) => (
                    <tr key={position.id}>
                      <td>{position.line_number}</td>
                      <td><strong>{position.nomenclature_name || "Название не получено"}</strong></td>
                      <td>{formatQuantity(position.quantity)} {position.unit || ""}</td>
                      <td>—</td>
                      <td>—</td>
                      <td>{position.supply_action || "Ожидает расчёта"}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div> : null}
    </section>
  );
}
