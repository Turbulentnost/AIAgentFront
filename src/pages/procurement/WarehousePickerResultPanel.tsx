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
  WarehousePickerCaseDetail,
  WarehousePickerOutput,
  WarehousePickerPosition
} from "@/types/procurement";
import { useWarehousePickerAction } from "@/hooks/useProcurementDashboard";
import { caseTitle, formatDate, formatDateTime } from "@/utils/procurementDashboard";
import styles from "../ProcurementAgent.module.css";

type Props = { detail: WarehousePickerCaseDetail };
type ResultTab = "overview" | "calculation" | "sources" | "issues";

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

function withUnit(value: string | number | null | undefined, unit?: string): string {
  return `${quantity(value)}${unit ? ` ${unit}` : ""}`;
}

function pickQty(position: Record<string, unknown>, ...keys: string[]): string | number | null {
  for (const key of keys) {
    const value = position[key];
    if (value !== null && value !== undefined && value !== "") {
      return value as string | number;
    }
  }
  return null;
}

function outputFrom(detail: WarehousePickerCaseDetail): WarehousePickerOutput | null {
  const latest = (detail.latest_result as { output_data?: unknown; agent_id?: string } | null)
    ?.output_data;
  const latestAgent = (detail.latest_result as { agent_id?: string } | null)?.agent_id;
  const stored = detail.case_metadata?.warehouse_picker_output;
  const candidate =
    (stored && typeof stored === "object" ? stored : null) ||
    (latestAgent === "warehouse_picker_agent" && latest && typeof latest === "object"
      ? latest
      : null) ||
    (latest && typeof latest === "object" && !("gross_requirement" in ((latest as { positions?: unknown[] }).positions?.[0] || {}))
      ? latest
      : null);
  if (!candidate || typeof candidate !== "object") return null;
  const raw = candidate as Record<string, unknown>;
  if (!Array.isArray(raw.positions)) return null;
  const positions = raw.positions.map((value) => {
    const position = value as Record<string, unknown>;
    return {
      line_id: String(position.line_id || ""),
      nomenclature_name: String(position.nomenclature_name || ""),
      characteristic_name: (position.characteristic_name as string | null) || null,
      unit: String(position.unit || "шт"),
      requested_quantity: pickQty(position, "requested_quantity", "gross_requirement") ?? "",
      store_room_stock: pickQty(position, "store_room_stock") ?? 0,
      warehouse_stock: pickQty(position, "warehouse_stock", "available_for_issue") ?? 0,
      accounting_quantity: pickQty(position, "accounting_quantity") ?? 0,
      factual_quantity: pickQty(position, "factual_quantity") ?? 0,
      available_for_issue: pickQty(position, "available_for_issue", "confirmed_available") ?? 0,
      confirmed_available: pickQty(position, "confirmed_available") ?? 0,
      confirmed_deficit: pickQty(position, "confirmed_deficit", "net_requirement") ?? 0,
      quantity_to_issue: pickQty(position, "quantity_to_issue") ?? 0,
      quantity_to_purchase: pickQty(position, "quantity_to_purchase") ?? 0,
      reserved_other_quantity: pickQty(position, "reserved_other_quantity") ?? 0,
      has_discrepancy: Boolean(position.has_discrepancy),
      outcome: String(position.outcome || ""),
      recommendation: String(position.recommendation || ""),
      warehouse_name: (position.warehouse_name as string | null) || null,
      assignment_name: (position.assignment_name as string | null) || null,
      assignment_id: (position.assignment_id as string | null) || null,
      formulas:
        position.formulas && typeof position.formulas === "object"
          ? (position.formulas as Record<string, string>)
          : {},
      excluded_supply: Array.isArray(position.excluded_supply)
        ? (position.excluded_supply as WarehousePickerPosition["excluded_supply"])
        : []
    } satisfies WarehousePickerPosition;
  });
  const conclusionRaw =
    raw.conclusion && typeof raw.conclusion === "object"
      ? (raw.conclusion as Record<string, unknown>)
      : {};
  return {
    summary: String(raw.summary || ""),
    recommended_next_step: String(raw.recommended_next_step || ""),
    decision_kind: (raw.decision_kind as WarehousePickerOutput["decision_kind"]) || "none",
    calculated_at: raw.calculated_at as string | undefined,
    positions,
    case: (raw.case as WarehousePickerOutput["case"]) || undefined,
    conclusion: {
      requested_quantity: conclusionRaw.requested_quantity as string | undefined,
      available_quantity: conclusionRaw.available_quantity as string | undefined,
      confirmed_deficit: conclusionRaw.confirmed_deficit as string | undefined,
      quantity_to_issue: conclusionRaw.quantity_to_issue as string | undefined,
      quantity_to_purchase: conclusionRaw.quantity_to_purchase as string | undefined,
      warehouse_name: conclusionRaw.warehouse_name as string | undefined
    },
    missing_data: Array.isArray(raw.missing_data) ? (raw.missing_data as string[]) : [],
    validation_issues: Array.isArray(raw.validation_issues)
      ? (raw.validation_issues as Array<{ code: string; message: string }>)
      : [],
    excluded_capabilities: Array.isArray(raw.excluded_capabilities)
      ? (raw.excluded_capabilities as string[])
      : []
  };
}

const OUTCOME_LABELS: Record<string, string> = {
  issue_from_stock: "Выдача из остатка",
  partial_issue: "Обеспечено частично",
  deficit_confirmed: "Требуется закупка",
  discrepancy_return: "Возврат из-за расхождений",
  fully_available: "Полностью обеспечено",
  clarification_required: "Требуется уточнение"
};

const EXCLUSION_LABELS: Record<string, string> = {
  other_warehouse: "Другой склад",
  reserved_for_assignment: "Под другим назначением",
  reserved_for_other: "Резерв под другой заказ",
  quarantine: "Карантин",
  defective: "Брак",
  blocked: "Заблокировано",
  not_available_for_issue: "Недоступно к выдаче"
};

function outcomeTone(position: WarehousePickerPosition): "success" | "warning" | "danger" {
  if (position.outcome === "discrepancy_return") return "danger";
  if (numeric(position.confirmed_deficit) > 0) return "warning";
  return "success";
}

function formatBasisDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function positionsWord(count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return `${count} позиций`;
  if (last === 1) return `${count} позиция`;
  if (last >= 2 && last <= 4) return `${count} позиции`;
  return `${count} позиций`;
}

type BasisViewProps = {
  title: string;
  documentNumber?: string | null;
  documentDate?: string | null;
  documentStatus?: string | null;
  departmentName?: string | null;
  warehouseName?: string | null;
  productionOrder?: string | null;
  initiatorName?: string | null;
  requiredDate?: string | null;
  positionsCount?: number | null;
  sourceActive?: boolean;
  archiveReason?: string | null;
  basisNumber?: string | null;
  basisDate?: string | null;
  basisStatus?: string | null;
  basisType?: string | null;
};

function cleanText(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").replace(/\s*\.\s*$/, "").trim();
  return cleaned || null;
}

function BasisOverview({
  title,
  documentNumber,
  documentDate,
  documentStatus,
  departmentName,
  warehouseName,
  productionOrder,
  initiatorName,
  requiredDate,
  positionsCount,
  sourceActive,
  archiveReason,
  basisNumber,
  basisDate,
  basisStatus,
  basisType
}: BasisViewProps) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Участок", value: cleanText(departmentName) || "Не указан" },
    { label: "Склад", value: cleanText(warehouseName) || "Не указан" }
  ];
  const order = cleanText(productionOrder);
  if (productionOrder !== undefined) {
    rows.push({ label: "Пр. заказ", value: order || "Не определён" });
  }
  const initiator = cleanText(initiatorName);
  if (initiator) rows.push({ label: "Инициатор", value: initiator });
  if (requiredDate) {
    rows.push({ label: "Требуемая дата", value: formatDate(requiredDate) });
  }
  if (archiveReason) {
    rows.push({ label: "Архив", value: cleanText(archiveReason) || archiveReason });
  }

  const metaParts = [
    formatBasisDateTime(documentDate),
    typeof positionsCount === "number" ? positionsWord(positionsCount) : null,
    documentStatus || null
  ].filter(Boolean);

  const relatedNumber = cleanText(basisNumber);
  const relatedMeta = [formatBasisDateTime(basisDate), basisStatus]
    .filter((value) => value && value !== "—")
    .join(" · ");

  return (
    <div className={styles.engineerSectionCard}>
      <div className={styles.basisBlock}>
        <div className={styles.basisHeader}>
          <div>
            <h4>{title}</h4>
            <p className={styles.basisNumber}>{documentNumber || "Номер не указан"}</p>
            {metaParts.length ? (
              <div className={styles.basisMetaLine}>{metaParts.join(" · ")}</div>
            ) : null}
          </div>
          {typeof sourceActive === "boolean" ? (
            <span
              className={
                sourceActive
                  ? `${styles.basisPill} ${styles.basisPillOk}`
                  : `${styles.basisPill} ${styles.basisPillWarn}`
              }
            >
              {sourceActive ? "В 1С" : "Не в 1С"}
            </span>
          ) : null}
        </div>

        <dl className={styles.basisRows}>
          {rows.map((row) => (
            <div className={styles.basisRow} key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
          {relatedNumber || relatedMeta ? (
            <div className={styles.basisRow}>
              <dt>{basisType ? `Основание (${basisType})` : "Основание"}</dt>
              <dd>
                {relatedNumber || "—"}
                {relatedMeta ? (
                  <span className={styles.basisRowHint}> · {relatedMeta}</span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

export function WarehousePickerResultPanel({ detail }: Props) {
  const [activeTab, setActiveTab] = useState<ResultTab>("overview");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const output = useMemo(() => outputFrom(detail), [detail]);
  const confirmMutation = useWarehousePickerAction("confirm_conclusion");
  const ackMutation = useWarehousePickerAction("acknowledge_critical");
  const positions = output?.positions ?? [];
  const decisionKind =
    detail.picker_decision_kind ||
    output?.decision_kind ||
    (detail.case_metadata?.picker_decision_kind as string | undefined);
  const isArchived =
    detail.picker_work_status === "archived" || !detail.source_active;
  const awaiting =
    !isArchived &&
    (detail.picker_work_status === "awaiting_action" || detail.requires_human_review);
  const missingData = Array.from(
    new Set([
      ...(output?.missing_data ?? []),
      ...(output?.validation_issues ?? []).map((item) => item.message),
      ...(output?.excluded_capabilities ?? [])
    ])
  );
  const exclusions = positions.flatMap((position) =>
    (position.excluded_supply || []).map((item) => ({ position, item }))
  );
  const source = output?.case;
  const totals = useMemo(
    () =>
      positions.reduce(
        (result, position) => ({
          requested: result.requested + numeric(position.requested_quantity),
          available: result.available + numeric(position.available_for_issue),
          issue: result.issue + numeric(position.quantity_to_issue),
          deficit: result.deficit + numeric(position.confirmed_deficit)
        }),
        { requested: 0, available: 0, issue: 0, deficit: 0 }
      ),
    [positions]
  );
  const primaryUnit =
    positions.length > 0 && positions.every((position) => position.unit === positions[0].unit)
      ? positions[0].unit
      : "";
  const confirmAction =
    decisionKind === "discrepancy_return"
      ? "return_discrepancy"
      : decisionKind === "deficit_confirmation"
        ? "confirm_deficit"
        : decisionKind === "stock_confirmation" && totals.deficit > 0
          ? "partial_issue"
          : "issue_from_stock";

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
    const header = [
      "Номенклатура",
      "Назначение",
      "Потребность",
      "На складе",
      "К выдаче",
      "Дефицит",
      "Решение"
    ];
    const rows = positions.map((position) => [
      position.nomenclature_name,
      position.assignment_name || "",
      quantity(position.requested_quantity),
      quantity(position.warehouse_stock ?? position.available_for_issue),
      quantity(position.quantity_to_issue),
      quantity(position.confirmed_deficit),
      OUTCOME_LABELS[position.outcome] || position.outcome
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${source?.source_number || caseTitle(detail)}-picker.csv`;
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
          <p>Заключение по складскому наличию · Монтажный участок №2</p>
        </div>
        <div className={styles.lastCalculation}>
          <span>Последний расчёт</span>
          <strong>{formatDateTime(output?.calculated_at)}</strong>
        </div>
      </div>

      {!output ? (
        detail.picker_work_status === "archived" || !detail.source_active ? (
          <div className={styles.resultStatus}>
            <Info size={16} />
            <div>
              <strong>
                {detail.closed_reason_label ||
                  detail.picker_bucket_reason ||
                  "Кейс в архиве оркестратора"}
              </strong>
              <span>
                Заключение кладовщика не формировалось: основание закрыто до обработки
                ИИ-агентом по закупке.
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            {detail.picker_work_status === "processing"
              ? "ИИ-агент проверяет наличие на складе кейса..."
              : "Заключение ещё не получено."}
          </div>
        )
      ) : (
        <div
          className={`${styles.resultStatus} ${missingData.length ? styles.resultStatusWarning : ""}`}
        >
          {missingData.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <div>
            <strong>{output.summary}</strong>
            <span>{output.recommended_next_step}</span>
          </div>
        </div>
      )}

      {!output && (detail.picker_work_status === "archived" || !detail.source_active) ? (
        <div className={styles.engineerTabContent}>
          <BasisOverview
            title="Основание в архиве"
            documentNumber={detail.source_number}
            documentDate={detail.source_date}
            documentStatus={detail.source_status || detail.status}
            departmentName={detail.department_name}
            warehouseName={detail.warehouse_name}
            initiatorName={detail.initiator_name}
            requiredDate={detail.required_date}
            positionsCount={detail.positions?.length || detail.positions_count}
            sourceActive={detail.source_active}
            archiveReason={
              detail.closed_reason_label || detail.picker_bucket_reason || "—"
            }
            basisNumber={detail.source_basis_number}
            basisDate={detail.source_basis_date}
            basisStatus={detail.source_basis_status}
            basisType={detail.source_basis_type}
          />
          <div className={styles.engineerSectionCard}>
            <h4>Позиции документа ({detail.positions?.length || detail.positions_count || 0})</h4>
            {detail.positions?.length ? (
              <div className={styles.positionSummaryList}>
                {detail.positions.map((position) => (
                  <div className={styles.positionSummary} key={position.id || position.line_id}>
                    <div>
                      <strong>{position.nomenclature_name || "Номенклатура"}</strong>
                      <small>{position.unit || "шт"}</small>
                    </div>
                    <div>
                      <span>Количество</span>
                      <strong>{withUnit(position.quantity, position.unit || undefined)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>Позиции документа недоступны.</div>
            )}
          </div>
        </div>
      ) : null}

      {awaiting &&
      decisionKind &&
      decisionKind !== "critical_acknowledgement" &&
      decisionKind !== "none" ? (
        <div className={styles.engineerActionBar}>
          <div>
            <strong>Оркестратор ожидает решения</strong>
            <span>Подтвердите заключение и передайте кейс начальнику ОМТО.</span>
          </div>
          <button
            className={styles.primaryAction}
            disabled={confirmMutation.isPending}
            onClick={() =>
              confirmMutation.mutate({
                caseId: detail.id,
                action: confirmAction
              })
            }
            type="button"
          >
            <CheckCircle2 size={16} />
            {confirmMutation.isPending ? "Подтверждение..." : "Подтвердить и передать в ОМТО"}
          </button>
        </div>
      ) : null}

      {awaiting && decisionKind === "critical_acknowledgement" ? (
        <div className={styles.engineerActionBar}>
          <div>
            <strong>Расчёт остановлен</strong>
            <span>Подтвердите ознакомление. Кейс останется здесь до исправления данных в 1С.</span>
          </div>
          <button
            className={styles.secondaryAction}
            disabled={ackMutation.isPending}
            onClick={() => ackMutation.mutate({ caseId: detail.id })}
            type="button"
          >
            {ackMutation.isPending ? "Подтверждение..." : "Подтвердить ознакомление"}
          </button>
        </div>
      ) : null}

      {output ? (
        <>
          <div className={styles.engineerMetrics}>
            <div>
              <span>Потребность</span>
              <strong>{withUnit(totals.requested, primaryUnit)}</strong>
            </div>
            <div>
              <span>Доступно на складе</span>
              <strong className={styles.metricCovered}>
                {withUnit(totals.available, primaryUnit)}
              </strong>
            </div>
            <div>
              <span>К выдаче</span>
              <strong>{withUnit(totals.issue, primaryUnit)}</strong>
            </div>
            <div>
              <span>Дефицит</span>
              <strong className={totals.deficit > 0 ? styles.metricDeficit : styles.metricCovered}>
                {withUnit(totals.deficit, primaryUnit)}
              </strong>
            </div>
            <div>
              <span>Склад кейса</span>
              <strong>
                {output.conclusion?.warehouse_name ||
                  source?.warehouse_name ||
                  detail.warehouse_name ||
                  "Не указан"}
              </strong>
            </div>
          </div>

          <nav className={styles.engineerTabs} aria-label="Разделы заключения">
            <button
              className={activeTab === "overview" ? styles.engineerTabActive : styles.engineerTab}
              onClick={() => setActiveTab("overview")}
              type="button"
            >
              Обзор
            </button>
            <button
              className={
                activeTab === "calculation" ? styles.engineerTabActive : styles.engineerTab
              }
              onClick={() => setActiveTab("calculation")}
              type="button"
            >
              Расчёт по позициям <b>{positions.length}</b>
            </button>
            <button
              className={activeTab === "sources" ? styles.engineerTabActive : styles.engineerTab}
              onClick={() => setActiveTab("sources")}
              type="button"
            >
              Исключённые остатки <b>{exclusions.length}</b>
            </button>
            <button
              className={activeTab === "issues" ? styles.engineerTabActive : styles.engineerTab}
              onClick={() => setActiveTab("issues")}
              type="button"
            >
              Проблемы и данные <b>{missingData.length}</b>
            </button>
          </nav>
        </>
      ) : null}

      {output && activeTab === "overview" ? (
        <div className={styles.engineerTabContent}>
          <div className={styles.engineerOverviewGrid}>
            <BasisOverview
              title="Основание"
              documentNumber={source?.source_number || detail.source_number}
              documentDate={source?.source_date || detail.source_date}
              documentStatus={source?.source_status || detail.source_status}
              departmentName={source?.department_name || detail.department_name}
              warehouseName={source?.warehouse_name || detail.warehouse_name}
              productionOrder={
                source?.production_order_number ||
                source?.production_order_1c_ref ||
                null
              }
              initiatorName={detail.initiator_name}
              requiredDate={source?.required_date || detail.required_date}
              positionsCount={positions.length || detail.positions_count}
              sourceActive={detail.source_active}
              basisNumber={detail.source_basis_number}
              basisDate={detail.source_basis_date}
              basisStatus={detail.source_basis_status}
              basisType={detail.source_basis_type}
            />

            <div className={styles.engineerSectionCard}>
              <h4>Правило остатков</h4>
              <article className={styles.specificationHighlight}>
                <span>Учёт для кладовщика-комплектовщика</span>
                <strong>Склад кейса + назначение</strong>
                <small>
                  В покрытие идёт только остаток на складе документа. Товар под чужим
                  назначением не учитывается.
                </small>
              </article>
            </div>
          </div>

          <div className={styles.engineerSectionCard}>
            <h4>Итог по позициям</h4>
            <div className={styles.positionSummaryList}>
              {positions.map((position) => (
                <div className={styles.positionSummary} key={position.line_id}>
                  <div>
                    <strong>{position.nomenclature_name}</strong>
                    <small>
                      {position.assignment_name ||
                        position.characteristic_name ||
                        "Без назначения / характеристики"}
                    </small>
                  </div>
                  <div>
                    <span>Потребность</span>
                    <strong>{withUnit(position.requested_quantity, position.unit)}</strong>
                  </div>
                  <div>
                    <span>Доступно</span>
                    <strong className={styles.metricCovered}>
                      {withUnit(position.available_for_issue, position.unit)}
                    </strong>
                  </div>
                  <div>
                    <span>Дефицит</span>
                    <strong
                      className={
                        numeric(position.confirmed_deficit) > 0 ? styles.metricDeficit : ""
                      }
                    >
                      {withUnit(position.confirmed_deficit, position.unit)}
                    </strong>
                  </div>
                  <span
                    className={styles.outcomeBadge}
                    data-tone={outcomeTone(position)}
                  >
                    {OUTCOME_LABELS[position.outcome] || position.outcome}
                  </span>
                </div>
              ))}
            </div>
            {positions.length ? (
              <button
                className={styles.primaryAction}
                onClick={() => setActiveTab("calculation")}
                type="button"
              >
                Открыть полный расчёт <ChevronRight size={16} />
              </button>
            ) : (
              <div className={styles.emptyState}>Построчный расчёт отсутствует.</div>
            )}
          </div>

          <div className={styles.informationBox}>
            <Info size={17} />
            <div>
              <strong>Как считается доступность</strong>
              <span>
                Фильтр по складу кейса. Остатки с другим назначением (обособленные под другой
                заказ) исключаются из выдачи.
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {output && activeTab === "calculation" ? (
        <div className={styles.engineerTabContent}>
          <div className={styles.sectionHeading}>
            <div>
              <h4>Расчёт по позициям</h4>
              <p>Основные показатели в таблице; детали формулы — внутри строки.</p>
            </div>
            <button
              className={styles.secondaryAction}
              disabled={!positions.length}
              onClick={exportCalculation}
              type="button"
            >
              <Download size={15} /> Экспортировать
            </button>
          </div>
          {positions.length ? (
            <div className={styles.calculationTable}>
              <div className={styles.calculationHeader}>
                <span>Номенклатура</span>
                <span>Назначение</span>
                <span>Потребность</span>
                <span>На складе</span>
                <span>Дефицит</span>
                <span>К выдаче</span>
                <span>Решение</span>
              </div>
              {positions.map((position) => {
                const expanded = expandedRows.has(position.line_id);
                return (
                  <div className={styles.calculationItem} key={position.line_id}>
                    <button
                      aria-expanded={expanded}
                      className={styles.calculationRow}
                      onClick={() => toggleRow(position.line_id)}
                      type="button"
                    >
                      <span className={styles.rowNomenclature}>
                        <i>
                          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </i>
                        <span>
                          <strong>{position.nomenclature_name}</strong>
                          <small>{position.characteristic_name || "Без характеристики"}</small>
                        </span>
                      </span>
                      <span>
                        <strong>{position.assignment_name || "Без назначения"}</strong>
                        <small>{position.warehouse_name || detail.warehouse_name || "Склад кейса"}</small>
                      </span>
                      <span>
                        <strong>{withUnit(position.requested_quantity, position.unit)}</strong>
                        <small>по заказу</small>
                      </span>
                      <span>
                        <strong className={styles.metricCovered}>
                          {withUnit(
                            position.warehouse_stock ?? position.available_for_issue,
                            position.unit
                          )}
                        </strong>
                        <small>
                          учёт/факт: {quantity(position.accounting_quantity)} /{" "}
                          {quantity(position.factual_quantity)}
                        </small>
                      </span>
                      <span>
                        <strong
                          className={
                            numeric(position.confirmed_deficit) > 0 ? styles.metricDeficit : ""
                          }
                        >
                          {withUnit(position.confirmed_deficit, position.unit)}
                        </strong>
                        <small>
                          чужое назн.: {withUnit(position.reserved_other_quantity, position.unit)}
                        </small>
                      </span>
                      <span>
                        <strong>{withUnit(position.quantity_to_issue, position.unit)}</strong>
                        <small>к выдаче</small>
                      </span>
                      <span
                        className={styles.outcomeBadge}
                        data-tone={outcomeTone(position)}
                      >
                        {OUTCOME_LABELS[position.outcome] || position.outcome}
                      </span>
                    </button>
                    {expanded ? (
                      <div className={styles.calculationDetails}>
                        <div className={styles.calculationDetailsHeader}>
                          <div>
                            <span>Детализация позиции</span>
                            <strong>Как рассчитано наличие</strong>
                            <small>{position.recommendation}</small>
                          </div>
                          <span className={styles.confirmedBadge}>
                            <CheckCircle2 size={14} /> Расчёт подтверждён
                          </span>
                        </div>
                        <div className={styles.formulaRow}>
                          <div className={styles.formulaCard}>
                            <span>Доступно = остаток склада кейса − чужое назначение</span>
                            <strong>
                              {withUnit(
                                position.warehouse_stock ?? position.available_for_issue,
                                position.unit
                              )}{" "}
                              доступно из{" "}
                              {withUnit(
                                numeric(position.warehouse_stock ?? position.available_for_issue) +
                                  numeric(position.reserved_other_quantity),
                                position.unit
                              )}{" "}
                              на складе
                            </strong>
                            <small>{position.formulas?.assignment}</small>
                          </div>
                          <div>
                            <span>01</span>
                            <small>Потребность</small>
                            <strong>{withUnit(position.requested_quantity, position.unit)}</strong>
                          </div>
                          <div>
                            <span>02</span>
                            <small>Доступно к выдаче</small>
                            <strong>
                              − {withUnit(position.available_for_issue, position.unit)}
                            </strong>
                          </div>
                          <div
                            className={
                              numeric(position.confirmed_deficit) > 0
                                ? styles.netFormula
                                : styles.netFormulaOk
                            }
                          >
                            <span>03</span>
                            <small>Дефицит / к закупке</small>
                            <strong>{withUnit(position.confirmed_deficit, position.unit)}</strong>
                          </div>
                        </div>
                        <div className={styles.calculationExplanation}>
                          <div>
                            <span>Склад</span>
                            <strong>
                              {position.warehouse_name ||
                                detail.warehouse_name ||
                                "Склад из документа 1С"}
                            </strong>
                            <small>{position.formulas?.warehouse_filter}</small>
                          </div>
                          <div>
                            <span>Формула дефицита</span>
                            <strong>{position.formulas?.deficit || "—"}</strong>
                            <small>{position.formulas?.discrepancy}</small>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>Нет позиций для расчёта.</div>
          )}
        </div>
      ) : null}

      {output && activeTab === "sources" ? (
        <div className={styles.engineerTabContent}>
          <div className={styles.engineerSectionCard}>
            <h4>Исключённые остатки</h4>
            {exclusions.length ? (
              <div className={styles.positionSummaryList}>
                {exclusions.map(({ position, item }, index) => (
                  <div className={styles.positionSummary} key={`${position.line_id}-${index}`}>
                    <div>
                      <strong>{position.nomenclature_name}</strong>
                      <small>
                        {item?.assignment_name ||
                          EXCLUSION_LABELS[String(item?.reason || "")] ||
                          String(item?.reason || "исключено")}
                      </small>
                    </div>
                    <div>
                      <span>Количество</span>
                      <strong>{withUnit(item?.quantity, position.unit)}</strong>
                    </div>
                    <div>
                      <span>Причина</span>
                      <strong>
                        {EXCLUSION_LABELS[String(item?.reason || "")] ||
                          String(item?.reason || "—")}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>Исключённых остатков нет.</div>
            )}
          </div>
        </div>
      ) : null}

      {output && activeTab === "issues" ? (
        <div className={styles.engineerTabContent}>
          <div className={styles.engineerSectionCard}>
            <h4>Проблемы и данные</h4>
            {missingData.length ? (
              <ul className={styles.missingDataList}>
                {missingData.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <div className={styles.emptyState}>Критических проблем с данными нет.</div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
