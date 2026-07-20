import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Download,
  Info
} from "lucide-react";
import type {
  ProductionPreparationEngineerCaseDetail,
  ProductionPreparationEngineerOutput,
  ProductionPreparationPositionCalculation
} from "@/types/procurement";
import { caseTitle, formatDate, formatDateTime } from "@/utils/procurementDashboard";
import styles from "../ProcurementAgent.module.css";

type Props = {
  detail: ProductionPreparationEngineerCaseDetail;
};

function quantity(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString("ru-RU", { maximumFractionDigits: 3 })
    : String(value);
}

function outputFrom(detail: ProductionPreparationEngineerCaseDetail) {
  const latest = detail.latest_result?.output_data;
  const stored = detail.case_metadata?.production_preparation_engineer_output;
  const candidate = stored || latest;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const raw = candidate as Record<string, unknown>;
  if (!Array.isArray(raw.positions)) return null;
  return {
    ...raw,
    positions: raw.positions.map((value) => {
      const position = value as ProductionPreparationPositionCalculation;
      return {
        ...position,
        excluded_supply: Array.isArray(position.excluded_supply)
          ? position.excluded_supply
          : [],
        supply_breakdown: Array.isArray(position.supply_breakdown)
          ? position.supply_breakdown
          : []
      };
    }),
    specifications: Array.isArray(raw.specifications) ? raw.specifications : [],
    missing_data: Array.isArray(raw.missing_data) ? raw.missing_data : [],
    validation_issues: Array.isArray(raw.validation_issues)
      ? raw.validation_issues
      : [],
    excluded_capabilities: Array.isArray(raw.excluded_capabilities)
      ? raw.excluded_capabilities
      : []
  } as ProductionPreparationEngineerOutput;
}

const OUTCOME_LABELS: Record<string, string> = {
  fully_covered: "Полностью обеспечено",
  transfer_required: "Требуется перемещение",
  partially_covered: "Обеспечено частично",
  covered_by_open_order: "Покрыто открытым заказом",
  procurement_required: "Требуется закупка",
  critical_shortage: "Критический дефицит",
  clarification_required: "Требуется уточнение"
};

const CRITICALITY_LABELS: Record<string, string> = {
  normal: "Обычная",
  high: "Высокая",
  critical: "Критическая"
};

const SOURCE_LABELS: Record<string, string> = {
  warehouse: "Свободный остаток на складах",
  store_room: "Свободный остаток в кладовых",
  free_stock: "Свободный остаток",
  warehouse_stock: "Свободный остаток",
  other_warehouse: "Другие склады",
  other_warehouses: "Другие склады",
  confirmed_arrival: "Подтверждённые поступления",
  confirmed_arrivals: "Подтверждённые поступления",
  open_order: "Открытые заказы",
  transfer: "Перемещения",
  work_in_progress: "Незавершённое производство"
};

type ResultTab = "overview" | "calculation" | "sources" | "issues";

function numeric(value?: string | number | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function withUnit(value: string | number | null | undefined, unit?: string): string {
  return `${quantity(value)}${unit ? ` ${unit}` : ""}`;
}

function outcomeTone(position: ProductionPreparationPositionCalculation): "success" | "warning" | "danger" {
  if (position.criticality === "critical" || position.outcome === "critical_shortage") return "danger";
  if (numeric(position.net_requirement) > 0) return "warning";
  return "success";
}

export function ProductionPreparationEngineerResultPanel({ detail }: Props) {
  const [activeTab, setActiveTab] = useState<ResultTab>("overview");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const output = outputFrom(detail);
  const positions = output?.positions ?? [];
  const exclusions = positions.flatMap((position) =>
    position.excluded_supply.map((item) => ({ position, item }))
  );
  const deficits = positions.filter((position) => Number(position.net_requirement) > 0);
  const critical = positions.filter((position) => position.critical_impact);
  const missingData = Array.from(
    new Set([
      ...(output?.missing_data ?? []),
      ...(output?.validation_issues ?? []).map((item) => item.message),
      ...(output?.excluded_capabilities ?? [])
    ])
  );
  const source = output?.case;
  const totals = useMemo(
    () =>
      positions.reduce(
        (result, position) => ({
          gross: result.gross + numeric(position.gross_requirement),
          covered: result.covered + numeric(position.total_available_supply),
          net: result.net + numeric(position.net_requirement)
        }),
        { gross: 0, covered: 0, net: 0 }
      ),
    [positions]
  );
  const primaryUnit = positions.length > 0 && positions.every((position) => position.unit === positions[0].unit)
    ? positions[0].unit
    : "";
  const usedSources = positions.flatMap((position) =>
    position.supply_breakdown
      .filter((item) => numeric(item.quantity) > 0)
      .map((item) => ({ position, item }))
  );

  const toggleRow = (lineId: string) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  const exportCalculation = () => {
    if (!positions.length) return;
    const header = ["Номенклатура", "Характеристика", "Ед.", "Потребность", "Обеспечено", "Дефицит", "Требуемая дата", "Решение"];
    const rows = positions.map((position) => [
      position.nomenclature_name,
      position.characteristic_name || "",
      position.unit,
      quantity(position.gross_requirement),
      quantity(position.total_available_supply),
      quantity(position.net_requirement),
      formatDate(position.required_date),
      OUTCOME_LABELS[position.outcome] || position.outcome
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${source?.case_number || caseTitle(detail)}-calculation.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className={`${styles.detailsPanel} ${styles.engineerDetailsPanel}`}>
      <div className={styles.engineerPanelHeader}>
        <div>
          <div className={styles.engineerTitleRow}>
            <h3>{caseTitle(detail)}</h3>
            <span className={detail.source_active ? styles.syncBadgeOk : styles.syncBadge}>
              {detail.source_active ? "Основание актуально" : "Основание неактуально"}
            </span>
          </div>
          <p>Расчёт потребности и обеспеченности ТМЦ</p>
        </div>
        <div className={styles.lastCalculation}>
          <span>Последний расчёт</span>
          <strong>{formatDateTime(output?.calculated_at)}</strong>
        </div>
      </div>

      {!output ? (
        <div className={styles.emptyState}>
          Результат ещё не сформирован. Кейс находится в очереди или ожидает данные 1С.
        </div>
      ) : (
        <div className={`${styles.resultStatus} ${missingData.length ? styles.resultStatusWarning : ""}`}>
          {missingData.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <div>
            <strong>{output.summary}</strong>
            <span>{output.recommended_next_step}</span>
          </div>
        </div>
      )}

      {output ? (
        <>
          <div className={styles.engineerMetrics}>
            <div><span>Валовая потребность</span><strong>{withUnit(totals.gross, primaryUnit)}</strong></div>
            <div><span>Обеспечено</span><strong className={styles.metricCovered}>{withUnit(totals.covered, primaryUnit)}</strong></div>
            <div><span>Чистая потребность</span><strong>{withUnit(totals.net, primaryUnit)}</strong></div>
            <div><span>Дефицит</span><strong className={totals.net > 0 ? styles.metricDeficit : styles.metricCovered}>{withUnit(totals.net, primaryUnit)}</strong></div>
            <div><span>Требуемая дата</span><strong>{formatDate(source?.required_date || detail.required_date)}</strong></div>
          </div>

          <nav className={styles.engineerTabs} aria-label="Разделы расчёта">
            <button className={activeTab === "overview" ? styles.engineerTabActive : styles.engineerTab} onClick={() => setActiveTab("overview")} type="button">Обзор</button>
            <button className={activeTab === "calculation" ? styles.engineerTabActive : styles.engineerTab} onClick={() => setActiveTab("calculation")} type="button">Расчёт по позициям <b>{positions.length}</b></button>
            <button className={activeTab === "sources" ? styles.engineerTabActive : styles.engineerTab} onClick={() => setActiveTab("sources")} type="button">Источники покрытия <b>{usedSources.length + exclusions.length}</b></button>
            <button className={activeTab === "issues" ? styles.engineerTabActive : styles.engineerTab} onClick={() => setActiveTab("issues")} type="button">Проблемы и данные <b>{missingData.length}</b></button>
          </nav>
        </>
      ) : null}

      {output && activeTab === "overview" ? (
        <div className={styles.engineerTabContent}>
          <div className={styles.engineerOverviewGrid}>
            <div className={styles.engineerSectionCard}>
              <h4>Основание</h4>
              <div className={styles.engineerFacts}>
                <div><span>Документ 1С</span><strong>{source?.source_number || detail.source_number || "—"}</strong></div>
                <div><span>Дата документа</span><strong>{formatDateTime(source?.source_date || detail.source_date)}</strong></div>
                <div><span>Статус</span><strong>{source?.source_status || detail.source_status || "—"}</strong></div>
                <div><span>Производственный заказ</span><strong>{source?.production_order_number || source?.production_order_1c_ref || "Не определён"}</strong></div>
                <div><span>Подразделение</span><strong>{source?.department_name || detail.department_name || "—"}</strong></div>
                <div><span>Склад</span><strong>{source?.warehouse_name || detail.warehouse_name || "Не указан"}</strong></div>
              </div>
            </div>

            <div className={styles.engineerSectionCard}>
              <h4>Ресурсная спецификация</h4>
              {output.specifications.length ? output.specifications.slice(0, 1).map((specification) => (
                <article className={styles.specificationHighlight} key={specification.specification_id}>
                  <span>Выбрана для расчёта</span>
                  <strong>{specification.name}</strong>
                  <small>Материалов: {specification.materials.length} · версия: {specification.version || "—"}</small>
                </article>
              )) : <div className={styles.emptyState}>Действующая спецификация не выбрана.</div>}
              {output.specifications.length > 1 ? <small>Ещё спецификаций: {output.specifications.length - 1}</small> : null}
            </div>
          </div>

          <div className={styles.engineerSectionCard}>
            <h4>Итог по позициям</h4>
            <div className={styles.positionSummaryList}>
              {positions.map((position) => (
                <div className={styles.positionSummary} key={position.line_id}>
                  <div>
                    <strong>{position.nomenclature_name}</strong>
                    <small>{position.characteristic_name || "Без характеристики"}</small>
                  </div>
                  <div><span>Потребность</span><strong>{withUnit(position.gross_requirement, position.unit)}</strong></div>
                  <div><span>Обеспечено</span><strong className={styles.metricCovered}>{withUnit(position.total_available_supply, position.unit)}</strong></div>
                  <div><span>Дефицит</span><strong className={numeric(position.net_requirement) > 0 ? styles.metricDeficit : ""}>{withUnit(position.net_requirement, position.unit)}</strong></div>
                  <span className={styles.outcomeBadge} data-tone={outcomeTone(position)}>{OUTCOME_LABELS[position.outcome] || position.outcome}</span>
                </div>
              ))}
            </div>
            {positions.length ? (
              <button className={styles.primaryAction} onClick={() => setActiveTab("calculation")} type="button">
                Открыть полный расчёт <ChevronRight size={16} />
              </button>
            ) : <div className={styles.emptyState}>Подтверждённый построчный расчёт отсутствует.</div>}
          </div>

          <div className={critical.length ? styles.criticalBox : styles.informationBox}>
            {critical.length ? <CircleAlert size={17} /> : <Info size={17} />}
            <div>
              <strong>{critical.length ? "Выявлено критическое влияние" : "Критического влияния не выявлено"}</strong>
              <span>{critical.length ? `${critical.length} позиций могут повлиять на производство.` : "Позиции обеспечиваются к требуемой дате либо не требуют остановки производства."}</span>
            </div>
          </div>
        </div>
      ) : null}

      {output && activeTab === "calculation" ? (
        <div className={styles.engineerTabContent}>
          <div className={styles.sectionHeading}>
            <div><h4>Расчёт по позициям</h4><p>Основные показатели вынесены в таблицу, детали формулы раскрываются внутри строки.</p></div>
            <button className={styles.secondaryAction} disabled={!positions.length} onClick={exportCalculation} type="button"><Download size={15} /> Экспортировать</button>
          </div>
          {positions.length ? (
            <div className={styles.calculationTable}>
              <div className={styles.calculationHeader}>
                <span>Номенклатура</span><span>Заказ / этап</span><span>Потребность</span><span>Обеспечено</span><span>Дефицит</span><span>Требуемая дата</span><span>Решение</span>
              </div>
              {positions.map((position) => {
                const expanded = expandedRows.has(position.line_id);
                const hasWarehouseCalculation =
                  position.warehouse_stock_before !== undefined &&
                  position.warehouse_stock_used !== undefined &&
                  position.warehouse_stock_remaining !== undefined;
                const baseRequirement =
                  numeric(position.product_quantity) * numeric(position.consumption_rate);
                const lossQuantity = Math.max(
                  0,
                  numeric(position.gross_requirement) - baseRequirement
                );
                const coverageParts = position.supply_breakdown
                  .filter((item) => numeric(item.quantity) > 0)
                  .map(
                    (item) =>
                      `${SOURCE_LABELS[item.source_type] || item.source_type}: ${withUnit(item.quantity, position.unit)}`
                  );
                return (
                  <div className={styles.calculationItem} key={position.line_id}>
                    <button aria-expanded={expanded} className={styles.calculationRow} onClick={() => toggleRow(position.line_id)} type="button">
                      <span className={styles.rowNomenclature}>
                        <i>{expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</i>
                        <span><strong>{position.nomenclature_name}</strong><small>{position.characteristic_name || "Без характеристики"}</small></span>
                      </span>
                      <span><strong>{position.production_order || "Главная потребность"}</strong><small>{position.production_stage || "Этап не указан"}</small></span>
                      <span><strong>{withUnit(position.gross_requirement, position.unit)}</strong><small>по норме</small></span>
                      <span>
                        <strong className={styles.metricCovered}>{withUnit(position.total_available_supply, position.unit)}</strong>
                        <small>
                          {hasWarehouseCalculation
                            ? `остаток склада: ${withUnit(position.warehouse_stock_remaining, position.unit)}`
                            : "остаток склада пересчитывается"}
                        </small>
                      </span>
                      <span><strong className={numeric(position.net_requirement) > 0 ? styles.metricDeficit : ""}>{withUnit(position.net_requirement, position.unit)}</strong><small>{numeric(position.net_requirement) > 0 ? "требуется покрыть" : "не требуется"}</small></span>
                      <span><strong>{formatDate(position.required_date)}</strong><small>{position.criticality === "normal" ? "в срок" : CRITICALITY_LABELS[position.criticality]}</small></span>
                      <span className={styles.outcomeBadge} data-tone={outcomeTone(position)}>{OUTCOME_LABELS[position.outcome] || position.outcome}</span>
                    </button>
                    {expanded ? (
                      <div className={styles.calculationDetails}>
                        <div className={styles.calculationDetailsHeader}>
                          <div><span>Детализация позиции</span><strong>Как рассчитана потребность</strong><small>{position.recommendation}</small></div>
                          <span className={styles.confirmedBadge}><CheckCircle2 size={14} /> Расчёт подтверждён</span>
                        </div>
                        <div className={styles.formulaRow}>
                          <div className={styles.formulaCard}>
                            <span>Потребность = количество × норма + потери</span>
                            <strong>
                              {quantity(position.product_quantity)} изделий ×{" "}
                              {quantity(position.consumption_rate)} {position.unit} +{" "}
                              {withUnit(lossQuantity, position.unit)} ={" "}
                              {withUnit(position.gross_requirement, position.unit)}
                            </strong>
                            <small>
                              Потери: {quantity(baseRequirement)} ×{" "}
                              {quantity(position.technological_loss_percent)}% ={" "}
                              {withUnit(lossQuantity, position.unit)}
                            </small>
                          </div>
                          <div><span>01</span><small>Валовая потребность</small><strong>{withUnit(position.gross_requirement, position.unit)}</strong></div>
                          <div><span>02</span><small>Доступное покрытие</small><strong>− {withUnit(position.total_available_supply, position.unit)}</strong></div>
                          <div className={styles.netFormula}><span>03</span><small>Чистая потребность</small><strong>{withUnit(position.net_requirement, position.unit)}</strong></div>
                        </div>
                        <div className={styles.calculationExplanation}>
                          <div>
                            <span>Как рассчитана обеспеченность</span>
                            <strong>
                              {coverageParts.length
                                ? coverageParts.join(" + ")
                                : "Подтверждённые источники отсутствуют"}
                            </strong>
                            <small>
                              Итого принято в покрытие:{" "}
                              {withUnit(position.total_available_supply, position.unit)}
                            </small>
                          </div>
                          <div>
                            <span>Формула чистой потребности</span>
                            <strong>
                              max(0, {quantity(position.gross_requirement)} −{" "}
                              {quantity(position.total_available_supply)}) ={" "}
                              {withUnit(position.net_requirement, position.unit)}
                            </strong>
                          </div>
                          <div>
                            <span>Остаток после обеспечения</span>
                            {hasWarehouseCalculation ? (
                              <>
                                <strong>
                                  {quantity(position.warehouse_stock_before)} −{" "}
                                  {quantity(position.warehouse_stock_used)} ={" "}
                                  {withUnit(position.warehouse_stock_remaining, position.unit)}
                                </strong>
                                <small>Остаток на складах минус использованное покрытие</small>
                              </>
                            ) : (
                              <>
                                <strong>Пересчитывается по данным 1С</strong>
                                <small>Предыдущий расчёт не содержал полного складского остатка.</small>
                              </>
                            )}
                          </div>
                        </div>
                        <div className={styles.detailMetricRow}>
                          <div><span>На складах до расчёта</span><strong>{hasWarehouseCalculation ? withUnit(position.warehouse_stock_before, position.unit) : "Пересчитывается"}</strong></div>
                          <div><span>Использовано со складов</span><strong>{hasWarehouseCalculation ? withUnit(position.warehouse_stock_used, position.unit) : "Пересчитывается"}</strong></div>
                          <div><span>Осталось на складах</span><strong>{hasWarehouseCalculation ? withUnit(position.warehouse_stock_remaining, position.unit) : "Пересчитывается"}</strong></div>
                          <div><span>Другие склады и поступления</span><strong>{withUnit(numeric(position.available_other_warehouses) + numeric(position.confirmed_arrivals), position.unit)}</strong></div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : <div className={styles.emptyState}>Подтверждённый построчный расчёт отсутствует.</div>}
        </div>
      ) : null}

      {output && activeTab === "sources" ? (
        <div className={styles.engineerTabContent}>
          <div className={styles.sectionHeading}><div><h4>Источники покрытия</h4><p>Отдельно показаны использованные и исключённые источники.</p></div></div>
          <div className={styles.sourceGrid}>
            {usedSources.map(({ position, item }, index) => (
              <article className={styles.sourceCard} data-status="used" key={`${position.line_id}-${item.source_type}-${index}`}>
                <span>Использован</span>
                <small>{SOURCE_LABELS[item.source_type] || item.source_type}</small>
                <strong>{withUnit(item.quantity, position.unit)}</strong>
                <p>{position.nomenclature_name}</p>
              </article>
            ))}
            {exclusions.map(({ position, item }) => (
              <article className={styles.sourceCard} data-status="excluded" key={`${position.line_id}-${item.supply_id}`}>
                <span>Исключён</span>
                <small>{position.nomenclature_name}</small>
                <strong>{withUnit(item.quantity, position.unit)}</strong>
                <p>{item.reason}</p>
              </article>
            ))}
          </div>
          {!usedSources.length && !exclusions.length ? <div className={styles.emptyState}>Сведения об источниках покрытия отсутствуют.</div> : null}
        </div>
      ) : null}

      {output && activeTab === "issues" ? (
        <div className={styles.engineerTabContent}>
          <div className={styles.sectionHeading}><div><h4>Проблемы и качество данных</h4><p>Бизнес-проблемы отделены от технической диагностики.</p></div></div>
          {deficits.length ? (
            <div className={styles.deficitBlock}>
              <CircleAlert size={18} />
              <div><strong>Обнаружен дефицит по {deficits.length} поз.</strong><span>Суммарная чистая потребность: {withUnit(totals.net, primaryUnit)}</span></div>
            </div>
          ) : <div className={styles.informationBox}><CheckCircle2 size={17} /><div><strong>Бизнес-проблем нет</strong><span>Дефицит по рассчитанным позициям отсутствует.</span></div></div>}
          {deficits.map((position) => (
            <div className={styles.issueCard} key={position.line_id}>
              <div><strong>{position.nomenclature_name}</strong><span>Дефицит: {withUnit(position.net_requirement, position.unit)}</span></div>
              <p>{position.recommendation}</p>
            </div>
          ))}
          <div className={styles.issueCard}>
            <div><strong>Техническая диагностика</strong><span>{missingData.length} сообщений</span></div>
            {missingData.length ? <ul className={styles.missingDataList}>{missingData.map((message) => <li key={message}>{message}</li>)}</ul> : <p>Ошибок и недоступных данных нет.</p>}
          </div>
        </div>
      ) : null}
    </section>
  );
}
