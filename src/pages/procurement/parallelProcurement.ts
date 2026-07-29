import type { ProcurementCaseDetail, WarehousePickerPosition } from "@/types/procurement";

export const PICKER_AGENT_ID = "warehouse_picker_agent";
export const COMPLEX_CHIEF_AGENT_ID = "warehouse_complex_chief_agent";
export const PURCHASE_MANAGER_AGENT_ID = "purchase_manager_agent";
export const QUALITY_ENGINEER_AGENT_ID = "quality_engineer_agent";

export type ParallelBranch = {
  id: string;
  agentId: string;
  label: string;
  status: "running" | "completed" | "pending";
  summary: string;
};

export type ParallelUncoveredPosition = {
  line_id: string;
  nomenclature_name: string;
  unit: string;
  requested_quantity: string | number;
  available_for_issue: string | number;
  confirmed_deficit: string | number;
  outcome: string;
};

export type ParallelSupplierOrderRow = {
  key: string;
  supplier_order_number: string;
  nomenclature_name: string;
  quantity: string | number;
  unit: string;
  supplier_name: string;
  arrival_date: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isRoleWorkspaceActive(
  workStatus?: string | null,
  archivedAt?: string | null
): boolean {
  if (archivedAt) return false;
  return workStatus !== "archived";
}

export function detectParallelProcurement(detail: ProcurementCaseDetail): {
  /** True only for partial coverage: picker and purchase manager work in parallel. */
  active: boolean;
  branches: ParallelBranch[];
  /** Linear next stage when picker is closed and only purchase manager remains. */
  continuation: ParallelBranch | null;
  forkAfterStageId: string;
  coverageStatus: string;
} {
  const assigned = detail.assigned_agents || [];
  const coverage = asRecord(detail.case_metadata?.supplier_order_coverage);
  const coverageStatus = text(coverage?.coverage_status);
  const tmcCoverage = asRecord(detail.case_metadata?.tmc_presentation_coverage);
  const tmcStatus = text(tmcCoverage?.status);
  const otkHandedOff = Boolean(detail.case_metadata?.otk_handed_off_at);
  const otkStarted = Boolean(detail.case_metadata?.otk_started_at) || otkHandedOff;
  const pickerAssigned = assigned.includes(PICKER_AGENT_ID);
  const complexAssigned = assigned.includes(COMPLEX_CHIEF_AGENT_ID);
  const warehouseAssigned = pickerAssigned || complexAssigned;
  const warehouseAgentId = complexAssigned ? COMPLEX_CHIEF_AGENT_ID : PICKER_AGENT_ID;
  const warehouseWorkStatus = complexAssigned
    ? detail.complex_work_status || detail.picker_work_status
    : detail.picker_work_status;
  const warehouseArchivedAt = complexAssigned
    ? detail.complex_workspace_archived_at || detail.picker_workspace_archived_at
    : detail.picker_workspace_archived_at;
  const warehouseDecisionKind = complexAssigned
    ? detail.complex_decision_kind || detail.picker_decision_kind
    : detail.picker_decision_kind;
  const warehouseLabel = complexAssigned
    ? "Начальник складского комплекса"
    : "Кладовщик-комплектовщик";
  const managerAssigned =
    assigned.includes(PURCHASE_MANAGER_AGENT_ID) ||
    Boolean(detail.purchase_manager_invoked_at) ||
    coverageStatus === "full" ||
    coverageStatus === "partial";
  const otkAssigned =
    assigned.includes(QUALITY_ENGINEER_AGENT_ID) ||
    detail.current_agent_id === QUALITY_ENGINEER_AGENT_ID ||
    otkStarted;
  const pickerActive =
    warehouseAssigned &&
    isRoleWorkspaceActive(warehouseWorkStatus, warehouseArchivedAt);
  const managerActive =
    managerAssigned &&
    !otkHandedOff &&
    isRoleWorkspaceActive(
      detail.purchase_manager_work_status,
      detail.purchase_manager_workspace_archived_at
    );
  // OTK appears as soon as there is at least one TMC journal row (partial or full).
  const otkActive =
    otkAssigned && (tmcStatus === "partial" || tmcStatus === "full" || otkStarted);

  // Parallel fork whenever 2+ role agents are active together.
  const parallelAgents = [pickerActive, managerActive, otkActive].filter(Boolean).length;
  const active = parallelAgents >= 2;

  const branches: ParallelBranch[] = [];
  if (active) {
    if (pickerActive) {
      branches.push({
        id: "branch_picker",
        agentId: warehouseAgentId,
        label: warehouseLabel,
        status: warehouseWorkStatus === "processing" ? "running" : "running",
        summary: complexAssigned
          ? "Непокрытый дефицит остаётся у начальника складского комплекса"
          : "Непокрытый дефицит остаётся у комплектовщика"
      });
    }
    if (managerActive) {
      branches.push({
        id: "branch_purchase_manager",
        agentId: PURCHASE_MANAGER_AGENT_ID,
        label: "Менеджер по закупкам",
        status:
          detail.purchase_manager_work_status === "completed" ? "completed" : "running",
        summary:
          tmcStatus === "partial"
            ? "Ждёт журнал ТМЦ по оставшимся заказам поставщику"
            : "Контроль заказов поставщику по покрытым позициям"
      });
    }
    if (otkActive) {
      branches.push({
        id: "branch_otk",
        agentId: QUALITY_ENGINEER_AGENT_ID,
        label: "Работник ОТК",
        status: "running",
        summary:
          tmcStatus === "partial"
            ? "Входной контроль по ЗП, уже есть в журнале ТМЦ"
            : "Входной контроль по журналу предъявления ТМЦ"
      });
    }
  }

  let continuation: ParallelBranch | null = null;
  if (!active && otkActive) {
    continuation = {
      id: "branch_otk",
      agentId: QUALITY_ENGINEER_AGENT_ID,
      label: "Работник ОТК",
      status: "running",
      summary: "Входной контроль по журналу предъявления ТМЦ"
    };
  } else if (!active && managerActive && (coverageStatus === "full" || !pickerActive)) {
    continuation = {
      id: "branch_purchase_manager",
      agentId: PURCHASE_MANAGER_AGENT_ID,
      label: "Менеджер по закупкам",
      status:
        detail.purchase_manager_work_status === "completed"
          ? "completed"
          : "running",
      summary:
        coverageStatus === "full"
          ? "Все позиции покрыты заказами поставщику"
          : "Контроль заказов поставщику"
    };
  } else if (!active && pickerActive) {
    // Только складской агент: показываем его как текущий этап маршрута.
    continuation = {
      id: "branch_picker",
      agentId: warehouseAgentId,
      label: warehouseLabel,
      status: warehouseWorkStatus === "processing" ? "running" : "running",
      summary:
        warehouseDecisionKind === "deficit_confirmation"
          ? "Ожидает подтверждения дефицита / выдачи"
          : "Проверка наличия и дефицита по складу кейса"
    };
  }

  // Точка ветвления: дефицит комплектовщика — от Обеспечения; иначе PM+ОТК от Закупки.
  const forkAfterStageId = pickerActive
    ? "coverage"
    : managerActive || otkActive
      ? "purchase"
      : "coverage";

  return {
    active,
    branches,
    continuation,
    forkAfterStageId,
    coverageStatus
  };
}

export function uncoveredPickerPositions(
  detail: ProcurementCaseDetail
): ParallelUncoveredPosition[] {
  const coverage = asRecord(detail.case_metadata?.supplier_order_coverage);
  const coveragePositions = Array.isArray(coverage?.positions)
    ? (coverage.positions as Array<Record<string, unknown>>)
    : [];
  const purchasingLineIds = new Set(
    coveragePositions
      .filter((item) => Boolean(item.purchasing))
      .map((item) => text(item.line_id))
      .filter(Boolean)
  );
  const purchasingNomIds = new Set(
    coveragePositions
      .filter((item) => Boolean(item.purchasing))
      .map((item) => text(item.nomenclature_id))
      .filter(Boolean)
  );

  const pickerOutput =
    asRecord(detail.case_metadata?.warehouse_picker_output) ||
    asRecord(detail.case_metadata?.warehouse_complex_output);
  const pickerPositions = Array.isArray(pickerOutput?.positions)
    ? (pickerOutput.positions as Array<Record<string, unknown>>)
    : [];

  if (pickerPositions.length) {
    return pickerPositions
      .filter((position) => {
        const lineId = text(position.line_id);
        const nomenclatureId = text(position.nomenclature_id);
        const already =
          Boolean(position.already_being_purchased) ||
          purchasingLineIds.has(lineId) ||
          (nomenclatureId ? purchasingNomIds.has(nomenclatureId) : false);
        return !already;
      })
      .map((position, index) => ({
        line_id: text(position.line_id) || `picker-${index}`,
        nomenclature_name: text(position.nomenclature_name) || "Номенклатура",
        unit: text(position.unit) || "шт",
        requested_quantity:
          (position.requested_quantity as string | number) ??
          (position.gross_requirement as string | number) ??
          0,
        available_for_issue:
          (position.available_for_issue as string | number) ??
          (position.warehouse_stock as string | number) ??
          0,
        confirmed_deficit:
          (position.confirmed_deficit as string | number) ??
          (position.net_requirement as string | number) ??
          0,
        outcome: text(position.outcome) || "deficit_confirmed"
      }));
  }

  return coveragePositions
    .filter((item) => !item.purchasing)
    .map((item, index) => ({
      line_id: text(item.line_id) || `coverage-${index}`,
      nomenclature_name: text(item.nomenclature_name) || "Номенклатура",
      unit: "шт",
      requested_quantity: (item.requested_quantity as string | number) ?? 0,
      available_for_issue: 0,
      confirmed_deficit:
        (item.remaining_quantity as string | number) ??
        (item.requested_quantity as string | number) ??
        0,
      outcome: "deficit_confirmed"
    }));
}

export function parallelSupplierOrderRows(
  detail: ProcurementCaseDetail
): ParallelSupplierOrderRow[] {
  const coverage = asRecord(detail.case_metadata?.supplier_order_coverage);
  const coveragePositions = Array.isArray(coverage?.positions)
    ? (coverage.positions as Array<Record<string, unknown>>)
    : [];
  const unitByLine = new Map<string, string>();
  const pickerOutput =
    asRecord(detail.case_metadata?.warehouse_picker_output) ||
    asRecord(detail.case_metadata?.warehouse_complex_output);
  const pickerPositions = Array.isArray(pickerOutput?.positions)
    ? (pickerOutput.positions as WarehousePickerPosition[])
    : [];
  for (const position of pickerPositions) {
    unitByLine.set(String(position.line_id || ""), position.unit || "шт");
  }

  const rows: ParallelSupplierOrderRow[] = [];
  for (const position of coveragePositions) {
    if (!position.purchasing) continue;
    const nomenclatureName = text(position.nomenclature_name) || "Номенклатура";
    const lineId = text(position.line_id);
    const unit = unitByLine.get(lineId) || "шт";
    const orders = Array.isArray(position.supplier_orders)
      ? (position.supplier_orders as Array<Record<string, unknown>>)
      : [];
    if (!orders.length) {
      rows.push({
        key: `${lineId}-empty`,
        supplier_order_number: "—",
        nomenclature_name: nomenclatureName,
        quantity: (position.ordered_quantity as string | number) ?? 0,
        unit,
        supplier_name: "—",
        arrival_date: null
      });
      continue;
    }
    for (const [index, order] of orders.entries()) {
      rows.push({
        key: `${lineId}-${text(order.supplier_order_1c_ref) || index}`,
        supplier_order_number:
          text(order.supplier_order_number) || text(order.number) || "—",
        nomenclature_name: nomenclatureName,
        quantity: (order.quantity as string | number) ?? position.ordered_quantity ?? 0,
        unit,
        supplier_name: text(order.supplier_name) || "—",
        arrival_date: text(order.arrival_date) || null
      });
    }
  }
  return rows;
}

export function formatQty(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString("ru-RU", { maximumFractionDigits: 3 })
    : String(value);
}

export function withUnit(value: string | number | null | undefined, unit?: string): string {
  return `${formatQty(value)}${unit ? ` ${unit}` : ""}`;
}

export function deficitTone(value: string | number | null | undefined): boolean {
  return numeric(value) > 0;
}
