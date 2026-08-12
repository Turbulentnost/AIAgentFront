/**
 * TEMP(Aveon shift assignment viewer) — удалить вместе с кнопкой на DocumentAnalysisAgent.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, memo, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowDownAZ, ArrowUpAZ, Check, ChevronDown, CircleX, Download, FlipHorizontal2, Loader2, Search, X } from "lucide-react";
import { FormCheckbox } from "@/components/form-controls";
import styles from "./TempShiftAssignmentViewer.module.css";

import type { ShiftAssignmentMeta, ShiftAssignmentPriority, ShiftAssignmentRowKind } from "./shiftAssignmentTypes";
import type { ShiftResultEvalState } from "./shiftAssignmentProgress";
import ShiftEvalIndicator from "./ShiftEvalIndicator";
import { evaluateShiftTaskResult } from "./evaluateShiftTaskResult";
import { useAuth } from "@/auth/AuthContext";
import {
  resolveShiftManagerScope,
  SHIFT_MANAGER_COLUMN,
} from "./shiftManagerAccess";

export type { ShiftAssignmentMeta, ShiftAssignmentPriority, ShiftAssignmentRowKind } from "./shiftAssignmentTypes";

type ResultEvalStatus = "resolved" | "partial" | "not_resolved";

type TaskProgressStatus = "active" | "resolved" | "partial" | "not_resolved";

type StatusFilter = "all" | TaskProgressStatus;

type ProgressStats = {
  total: number;
  active: number;
  resolved: number;
  partial: number;
  notResolved: number;
  checking: number;
  resolvedPercent: number;
};

type ResultEvalState = {
  status?: ResultEvalStatus;
  comment?: string;
  loading?: boolean;
  error?: string;
};

type TaskContext = {
  taskType: string;
  problem: string;
  solution: string;
  nomenclature: string;
};

type Props = {
  open: boolean;
  embedded?: boolean;
  loading: boolean;
  error: string | null;
  values: string[][];
  rowPriorities: Array<ShiftAssignmentPriority | null>;
  rowKinds: ShiftAssignmentRowKind[];
  meta: ShiftAssignmentMeta | null;
  fileName: string;
  resultTexts?: Record<string, string>;
  onResultTextsChange?: Dispatch<SetStateAction<Record<string, string>>>;
  resultEvals?: Record<string, ShiftResultEvalState>;
  onResultEvalsChange?: Dispatch<SetStateAction<Record<string, ShiftResultEvalState>>>;
  onExport: () => void;
  onClose: () => void;
  onOpenShipmentSchedule?: () => void;
  onOpenShipmentScheduleHover?: () => void;
  shipmentScheduleAvailable?: boolean;
  onManagerResultEvaluated?: (
    context: TaskContext,
    managerResult: string,
    taskKey: string
  ) => Promise<void> | void;
};

const HIDDEN_COLUMNS = new Set(["Тип задания"]);
const RESULT_COLUMN_HEADER = "Результат работы менеджера";
const RESULT_COLUMN_LABEL = "Результат";
const EMPTY_CELL_VALUE = "(пусто)";
const FILTERABLE_COLUMN_BLACKLIST = new Set(["№"]);
const SORTABLE_COLUMN_HEADERS = new Set(["Дефицит", "Крайний срок"]);

function columnSupportsSort(header: string): boolean {
  return SORTABLE_COLUMN_HEADERS.has(header);
}

function columnSupportsFilter(header: string, managerScope: string | null): boolean {
  if (managerScope && header === SHIFT_MANAGER_COLUMN) return false;
  return !FILTERABLE_COLUMN_BLACKLIST.has(header) && !SORTABLE_COLUMN_HEADERS.has(header);
}

type SortDirection = "asc" | "desc";
type ColumnSortState = { header: string; direction: SortDirection } | null;
type ColumnFiltersState = Record<string, Set<string>>;

const TASK_TYPE_ORDER: Record<string, number> = {
  Отгрузка: 0,
  "Логистика МСК": 1,
  Таможня: 2,
  "Логистика Ростов": 3,
  "Необходимые закупки": 4,
};

function priorityClass(priority: ShiftAssignmentPriority | null | undefined): string {
  switch (priority) {
    case "urgent":
      return styles.rowUrgent;
    case "today":
      return styles.rowToday;
    case "week":
      return styles.rowWeek;
    default:
      return "";
  }
}

function columnClass(header: string): string {
  switch (header) {
    case "№":
      return styles.colNumber;
    case "Приоритет":
      return styles.colPriority;
    case "Проблема":
      return styles.colProblem;
    case "Что сделать":
      return styles.colSolution;
    case "Номенклатура":
      return styles.colNomenclature;
    case "Дефицит":
      return styles.colDeficit;
    case "Страна":
      return styles.colCountry;
    case "Поставщик":
      return styles.colSupplier;
    case "Крайний срок":
      return styles.colDeadline;
    case "Ответственный менеджер":
      return styles.colManager;
    case RESULT_COLUMN_HEADER:
      return styles.colResult;
    default:
      return "";
  }
}

function headerLabel(header: string): string {
  return header === RESULT_COLUMN_HEADER ? RESULT_COLUMN_LABEL : header;
}

function sortTaskTypes(types: string[]): string[] {
  return [...types].sort((left, right) => {
    const leftOrder = TASK_TYPE_ORDER[left] ?? 99;
    const rightOrder = TASK_TYPE_ORDER[right] ?? 99;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.localeCompare(right, "ru");
  });
}

function collectTaskTypeStats(
  body: string[][],
  rowKinds: ShiftAssignmentRowKind[]
): { types: string[]; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  let currentType = "";

  body.forEach((row, index) => {
    const kind = rowKinds[index + 1] ?? "task";
    if (kind === "group") {
      currentType = (row[0] ?? "").trim();
      if (currentType && counts[currentType] === undefined) {
        counts[currentType] = 0;
      }
      return;
    }
    if (kind === "task" && currentType) {
      counts[currentType] = (counts[currentType] ?? 0) + 1;
    }
  });

  return {
    types: sortTaskTypes(Object.keys(counts)),
    counts,
  };
}

function filterBodyRows(
  body: string[][],
  rowPriorities: Array<ShiftAssignmentPriority | null>,
  rowKinds: ShiftAssignmentRowKind[],
  filter: string
): {
  body: string[][];
  rowPriorities: Array<ShiftAssignmentPriority | null>;
  rowKinds: ShiftAssignmentRowKind[];
} {
  if (filter === "all") {
    return {
      body,
      rowPriorities: rowPriorities.slice(1),
      rowKinds: rowKinds.slice(1),
    };
  }

  const filteredBody: string[][] = [];
  const filteredPriorities: Array<ShiftAssignmentPriority | null> = [];
  const filteredKinds: ShiftAssignmentRowKind[] = [];
  let currentGroup = "";
  let includeGroup = false;

  body.forEach((row, index) => {
    const kind = rowKinds[index + 1] ?? "task";
    const priority = rowPriorities[index + 1] ?? null;

    if (kind === "group") {
      currentGroup = (row[0] ?? "").trim();
      includeGroup = currentGroup === filter;
      if (includeGroup) {
        filteredBody.push(row);
        filteredPriorities.push(priority);
        filteredKinds.push(kind);
      }
      return;
    }

    if (kind === "empty") {
      return;
    }

    if (kind === "task" && includeGroup) {
      filteredBody.push(row);
      filteredPriorities.push(priority);
      filteredKinds.push(kind);
    }
  });

  return {
    body: filteredBody,
    rowPriorities: filteredPriorities,
    rowKinds: filteredKinds,
  };
}

function withRenumberedTasks(
  body: string[][],
  rowKinds: ShiftAssignmentRowKind[],
  numberColIndex: number | null
): string[][] {
  if (numberColIndex === null || numberColIndex < 0) {
    return body;
  }

  let taskNumber = 0;
  return body.map((row, index) => {
    const kind = rowKinds[index] ?? "task";
    if (kind !== "task") {
      return row;
    }
    taskNumber += 1;
    const nextRow = [...row];
    nextRow[numberColIndex] = String(taskNumber);
    return nextRow;
  });
}

function buildTaskTypesByRow(body: string[][], rowKinds: ShiftAssignmentRowKind[]): string[] {
  const types: string[] = [];
  let currentType = "";

  body.forEach((row, index) => {
    const kind = rowKinds[index] ?? "task";
    if (kind === "group") {
      currentType = (row[0] ?? "").trim();
      types.push("");
      return;
    }
    if (kind === "task") {
      types.push(currentType);
      return;
    }
    types.push("");
  });

  return types;
}

function buildTaskContextFromRow(
  row: string[],
  taskType: string,
  colIndexByHeader: Map<string, number>
): TaskContext {
  return {
    taskType,
    problem: row[colIndexByHeader.get("Проблема") ?? -1] ?? "",
    solution: row[colIndexByHeader.get("Что сделать") ?? -1] ?? "",
    nomenclature: row[colIndexByHeader.get("Номенклатура") ?? -1] ?? "",
  };
}

function getTaskProgressStatus(
  taskKey: string,
  resultEvals: Record<string, ResultEvalState>
): TaskProgressStatus {
  const evalState = resultEvals[taskKey];
  if (evalState?.loading) return "active";
  if (evalState?.status === "resolved") return "resolved";
  if (evalState?.status === "partial") return "partial";
  if (evalState?.status === "not_resolved") return "not_resolved";
  return "active";
}

function computeProgressStats(
  body: string[][],
  rowKinds: ShiftAssignmentRowKind[],
  resultEvals: Record<string, ResultEvalState>,
  colIndexByHeader: Map<string, number>
): ProgressStats {
  const taskTypes = buildTaskTypesByRow(body, rowKinds);
  const stats: ProgressStats = {
    total: 0,
    active: 0,
    resolved: 0,
    partial: 0,
    notResolved: 0,
    checking: 0,
    resolvedPercent: 0,
  };

  body.forEach((row, index) => {
    if ((rowKinds[index] ?? "task") !== "task") return;
    const context = buildTaskContextFromRow(row, taskTypes[index] ?? "", colIndexByHeader);
    const taskKey = buildTaskKey(context);
    const evalState = resultEvals[taskKey];
    const progressStatus = getTaskProgressStatus(taskKey, resultEvals);

    stats.total += 1;
    if (evalState?.loading) {
      stats.checking += 1;
    }
    if (progressStatus === "resolved") stats.resolved += 1;
    else if (progressStatus === "partial") stats.partial += 1;
    else if (progressStatus === "not_resolved") stats.notResolved += 1;
    else stats.active += 1;
  });

  stats.resolvedPercent =
    stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
  return stats;
}

function filterBodyByStatus(
  body: string[][],
  rowPriorities: Array<ShiftAssignmentPriority | null>,
  rowKinds: ShiftAssignmentRowKind[],
  statusFilter: StatusFilter,
  resultEvals: Record<string, ResultEvalState>,
  colIndexByHeader: Map<string, number>
): {
  body: string[][];
  rowPriorities: Array<ShiftAssignmentPriority | null>;
  rowKinds: ShiftAssignmentRowKind[];
} {
  if (statusFilter === "all") {
    return { body, rowPriorities, rowKinds };
  }

  const taskTypes = buildTaskTypesByRow(body, rowKinds);
  const filteredBody: string[][] = [];
  const filteredPriorities: Array<ShiftAssignmentPriority | null> = [];
  const filteredKinds: ShiftAssignmentRowKind[] = [];
  let pendingGroup: {
    row: string[];
    priority: ShiftAssignmentPriority | null;
  } | null = null;

  const flushGroup = () => {
    if (!pendingGroup) return;
    filteredBody.push(pendingGroup.row);
    filteredPriorities.push(pendingGroup.priority);
    filteredKinds.push("group");
    pendingGroup = null;
  };

  body.forEach((row, index) => {
    const kind = rowKinds[index] ?? "task";
    const priority = rowPriorities[index] ?? null;

    if (kind === "group") {
      flushGroup();
      pendingGroup = { row, priority };
      return;
    }

    if (kind !== "task") {
      return;
    }

    const context = buildTaskContextFromRow(row, taskTypes[index] ?? "", colIndexByHeader);
    const taskKey = buildTaskKey(context);
    if (getTaskProgressStatus(taskKey, resultEvals) !== statusFilter) {
      return;
    }

    if (pendingGroup) {
      flushGroup();
    }

    filteredBody.push(row);
    filteredPriorities.push(priority);
    filteredKinds.push(kind);
  });

  flushGroup();

  return {
    body: filteredBody,
    rowPriorities: filteredPriorities,
    rowKinds: filteredKinds,
  };
}

function normalizeCellValue(value: string): string {
  const trimmed = value.trim();
  return trimmed || EMPTY_CELL_VALUE;
}

function parseDeadlineValue(value: string): number {
  const match = value.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!match) return Number.NaN;
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  return Date.UTC(year, Number(match[2]) - 1, Number(match[1]));
}

function compareCellValues(left: string, right: string, header: string): number {
  const a = left.trim();
  const b = right.trim();
  if (header === "Дефицит" || header === "№") {
    const na = Number(a.replace(",", "."));
    const nb = Number(b.replace(",", "."));
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  }
  if (header === "Крайний срок") {
    const da = parseDeadlineValue(a);
    const db = parseDeadlineValue(b);
    if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  }
  return a.localeCompare(b, "ru", { sensitivity: "base" });
}

function getTaskCellValue(
  row: string[],
  header: string,
  colIndexByHeader: Map<string, number>,
  taskContext: TaskContext | null,
  resultTexts: Record<string, string>
): string {
  if (header === RESULT_COLUMN_HEADER && taskContext) {
    const taskKey = buildTaskKey(taskContext);
    const resultColIndex = colIndexByHeader.get(RESULT_COLUMN_HEADER) ?? -1;
    return normalizeCellValue(resultTexts[taskKey] ?? row[resultColIndex] ?? "");
  }
  const colIndex = colIndexByHeader.get(header);
  if (colIndex === undefined || colIndex < 0) return EMPTY_CELL_VALUE;
  return normalizeCellValue(row[colIndex] ?? "");
}

function collectColumnFilterOptions(
  body: string[][],
  rowKinds: ShiftAssignmentRowKind[],
  visibleHeaders: string[],
  colIndexByHeader: Map<string, number>,
  taskTypesByRow: string[],
  resultTexts: Record<string, string>,
  managerScope: string | null
): Record<string, Array<{ value: string; count: number }>> {
  const counters: Record<string, Map<string, number>> = {};
  for (const header of visibleHeaders) {
    if (!columnSupportsFilter(header, managerScope)) continue;
    counters[header] = new Map();
  }

  body.forEach((row, index) => {
    if ((rowKinds[index] ?? "task") !== "task") return;
    const context = buildTaskContextFromRow(row, taskTypesByRow[index] ?? "", colIndexByHeader);
    for (const header of visibleHeaders) {
      if (!columnSupportsFilter(header, managerScope)) continue;
      const value = getTaskCellValue(row, header, colIndexByHeader, context, resultTexts);
      const bucket = counters[header];
      bucket.set(value, (bucket.get(value) ?? 0) + 1);
    }
  });

  const options: Record<string, Array<{ value: string; count: number }>> = {};
  for (const [header, bucket] of Object.entries(counters)) {
    options[header] = [...bucket.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => compareCellValues(left.value, right.value, header));
  }
  return options;
}

function filterBodyByColumnFilters(
  body: string[][],
  rowPriorities: Array<ShiftAssignmentPriority | null>,
  rowKinds: ShiftAssignmentRowKind[],
  columnFilters: ColumnFiltersState,
  colIndexByHeader: Map<string, number>,
  taskTypesByRow: string[],
  resultTexts: Record<string, string>
): {
  body: string[][];
  rowPriorities: Array<ShiftAssignmentPriority | null>;
  rowKinds: ShiftAssignmentRowKind[];
} {
  const activeHeaders = Object.keys(columnFilters);
  if (activeHeaders.length === 0) {
    return { body, rowPriorities, rowKinds };
  }

  const filteredBody: string[][] = [];
  const filteredPriorities: Array<ShiftAssignmentPriority | null> = [];
  const filteredKinds: ShiftAssignmentRowKind[] = [];
  let pendingGroup: {
    row: string[];
    priority: ShiftAssignmentPriority | null;
  } | null = null;

  const flushGroup = () => {
    if (!pendingGroup) return;
    filteredBody.push(pendingGroup.row);
    filteredPriorities.push(pendingGroup.priority);
    filteredKinds.push("group");
    pendingGroup = null;
  };

  body.forEach((row, index) => {
    const kind = rowKinds[index] ?? "task";
    const priority = rowPriorities[index] ?? null;

    if (kind === "group") {
      flushGroup();
      pendingGroup = { row, priority };
      return;
    }

    if (kind !== "task") {
      return;
    }

    const context = buildTaskContextFromRow(row, taskTypesByRow[index] ?? "", colIndexByHeader);
    const matches = activeHeaders.every((header) => {
      const allowed = columnFilters[header];
      if (!allowed) return true;
      if (allowed.size === 0) return false;
      const value = getTaskCellValue(row, header, colIndexByHeader, context, resultTexts);
      return allowed.has(value);
    });

    if (!matches) return;

    if (pendingGroup) {
      flushGroup();
    }

    filteredBody.push(row);
    filteredPriorities.push(priority);
    filteredKinds.push(kind);
  });

  flushGroup();

  return {
    body: filteredBody,
    rowPriorities: filteredPriorities,
    rowKinds: filteredKinds,
  };
}

function sortTasksWithinGroups(
  body: string[][],
  rowPriorities: Array<ShiftAssignmentPriority | null>,
  rowKinds: ShiftAssignmentRowKind[],
  sortState: ColumnSortState,
  colIndexByHeader: Map<string, number>,
  taskTypesByRow: string[],
  resultTexts: Record<string, string>
): {
  body: string[][];
  rowPriorities: Array<ShiftAssignmentPriority | null>;
  rowKinds: ShiftAssignmentRowKind[];
} {
  if (!sortState) {
    return { body, rowPriorities, rowKinds };
  }

  const colIndex = colIndexByHeader.get(sortState.header);
  if (colIndex === undefined && sortState.header !== RESULT_COLUMN_HEADER) {
    return { body, rowPriorities, rowKinds };
  }

  const outBody: string[][] = [];
  const outPriorities: Array<ShiftAssignmentPriority | null> = [];
  const outKinds: ShiftAssignmentRowKind[] = [];
  let batch: Array<{
    row: string[];
    priority: ShiftAssignmentPriority | null;
    kind: ShiftAssignmentRowKind;
    rowIndex: number;
  }> = [];

  const flushBatch = () => {
    if (!batch.length) return;
    batch.sort((left, right) => {
      const leftContext = buildTaskContextFromRow(
        left.row,
        taskTypesByRow[left.rowIndex] ?? "",
        colIndexByHeader
      );
      const rightContext = buildTaskContextFromRow(
        right.row,
        taskTypesByRow[right.rowIndex] ?? "",
        colIndexByHeader
      );
      const leftValue = getTaskCellValue(
        left.row,
        sortState.header,
        colIndexByHeader,
        leftContext,
        resultTexts
      );
      const rightValue = getTaskCellValue(
        right.row,
        sortState.header,
        colIndexByHeader,
        rightContext,
        resultTexts
      );
      const cmp = compareCellValues(leftValue, rightValue, sortState.header);
      return sortState.direction === "asc" ? cmp : -cmp;
    });
    for (const item of batch) {
      outBody.push(item.row);
      outPriorities.push(item.priority);
      outKinds.push(item.kind);
    }
    batch = [];
  };

  body.forEach((row, index) => {
    const kind = rowKinds[index] ?? "task";
    if (kind === "group") {
      flushBatch();
      outBody.push(row);
      outPriorities.push(rowPriorities[index] ?? null);
      outKinds.push(kind);
      return;
    }
    if (kind === "task") {
      batch.push({
        row,
        priority: rowPriorities[index] ?? null,
        kind,
        rowIndex: index,
      });
    }
  });
  flushBatch();

  return {
    body: outBody,
    rowPriorities: outPriorities,
    rowKinds: outKinds,
  };
}

type ColumnHeaderMenuProps = {
  header: string;
  label: string;
  options: Array<{ value: string; count: number }>;
  selectedValues: Set<string> | null;
  sortDirection: SortDirection | null;
  sortable: boolean;
  filterable: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSort: (direction: SortDirection | null) => void;
  onToggleValue: (value: string) => void;
  onSelectAll: () => void;
  onClearFilter: () => void;
};

function computeColumnMenuPlacement(
  anchor: HTMLElement,
  capturedRect?: DOMRectReadOnly | null
): { portalRoot: HTMLElement; style: CSSProperties } | null {
  const cell = (anchor.closest("th") ?? anchor) as HTMLElement;
  const portalRoot =
    (anchor.closest("[data-column-menu-portal]") as HTMLElement | null) ?? document.body;
  const cellRect = capturedRect ?? cell.getBoundingClientRect();
  const menuWidth = Math.max(cellRect.width, 260);
  const maxWidth = Math.min(360, window.innerWidth - 24);
  const viewportPadding = 12;

  if (portalRoot === document.body) {
    let left = cellRect.left;
    if (left + menuWidth > window.innerWidth - viewportPadding) {
      left = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding);
    }
    return {
      portalRoot,
      style: {
        position: "fixed",
        top: cellRect.bottom + 4,
        left,
        width: menuWidth,
        maxWidth,
        zIndex: 1310,
      },
    };
  }

  const rootRect = portalRoot.getBoundingClientRect();
  const rootStyle = window.getComputedStyle(portalRoot);
  const paddingLeft = Number.parseFloat(rootStyle.paddingLeft) || 0;
  const paddingTop = Number.parseFloat(rootStyle.paddingTop) || 0;
  let left = cellRect.left - rootRect.left - paddingLeft;
  const top = cellRect.bottom - rootRect.top - paddingTop + 4;
  const availableWidth = portalRoot.clientWidth;

  if (left + menuWidth > availableWidth - viewportPadding) {
    left = Math.max(viewportPadding, availableWidth - menuWidth - viewportPadding);
  }

  return {
    portalRoot,
    style: {
      position: "absolute",
      top,
      left,
      width: menuWidth,
      maxWidth,
      zIndex: 1310,
    },
  };
}

function ColumnHeaderMenu({
  header,
  label,
  options,
  selectedValues,
  sortDirection,
  sortable,
  filterable,
  isOpen,
  onToggle,
  onClose,
  onSort,
  onToggleValue,
  onSelectAll,
  onClearFilter,
}: ColumnHeaderMenuProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const capturedRectRef = useRef<DOMRectReadOnly | null>(null);
  const [query, setQuery] = useState("");
  const [menuPlacement, setMenuPlacement] = useState<{
    portalRoot: HTMLElement;
    style: CSSProperties;
  } | null>(null);

  const syncMenuPlacement = useCallback((capturedRect?: DOMRectReadOnly | null) => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const nextPlacement = computeColumnMenuPlacement(anchor, capturedRect);
    if (nextPlacement) setMenuPlacement(nextPlacement);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPlacement(null);
      setQuery("");
      capturedRectRef.current = null;
      return;
    }
    syncMenuPlacement(capturedRectRef.current);
    capturedRectRef.current = null;
    const rafId = requestAnimationFrame(() => syncMenuPlacement());
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, syncMenuPlacement]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const anchor = anchorRef.current;
    const scrollRoot = anchor?.closest("[data-table-scroll]");
    const updatePosition = () => syncMenuPlacement();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    scrollRoot?.addEventListener("scroll", updatePosition, { passive: true });

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      scrollRoot?.removeEventListener("scroll", updatePosition);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen, onClose, syncMenuPlacement]);

  const handleToggle = () => {
    if (!isOpen && anchorRef.current) {
      const cell = (anchorRef.current.closest("th") ?? anchorRef.current) as HTMLElement;
      capturedRectRef.current = cell.getBoundingClientRect();
    }
    onToggle();
  };

  const allValues = useMemo(() => options.map((option) => option.value), [options]);
  const effectiveSelected = selectedValues ?? new Set(allValues);
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.value.toLowerCase().includes(normalized));
  }, [options, query]);

  const isFiltered =
    filterable &&
    selectedValues !== null &&
    (selectedValues.size === 0 || selectedValues.size < allValues.length);
  const isActive = (filterable && isFiltered) || (sortable && sortDirection !== null);
  const menuAriaLabel = sortable && !filterable ? `Сортировка: ${label}` : `Фильтр: ${label}`;

  return (
    <div className={styles.columnHeaderWrap} ref={anchorRef}>
      <button
        type="button"
        className={`${styles.columnHeaderBtn} ${isOpen ? styles.columnHeaderBtnOpen : ""} ${
          isActive ? styles.columnHeaderBtnActive : ""
        }`}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={menuAriaLabel}
      >
        <span className={styles.columnHeaderLabel}>{label}</span>
        {isActive && <span className={styles.columnHeaderDot} aria-hidden />}
        <ChevronDown
          size={14}
          className={`${styles.columnHeaderChevron} ${isOpen ? styles.columnHeaderChevronOpen : ""}`}
          aria-hidden
        />
      </button>

      {isOpen && menuPlacement
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.columnMenu}
              style={menuPlacement.style}
              role="menu"
              aria-label={menuAriaLabel}
            >
              {sortable ? (
                <div className={styles.columnMenuSection}>
                  <p className={styles.columnMenuSectionTitle}>Сортировка</p>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={sortDirection === "asc"}
                    className={`${styles.columnMenuAction} ${sortDirection === "asc" ? styles.columnMenuActionActive : ""}`}
                    onClick={() => onSort(sortDirection === "asc" ? null : "asc")}
                  >
                    <ArrowUpAZ size={15} aria-hidden />
                    По возрастанию
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={sortDirection === "desc"}
                    className={`${styles.columnMenuAction} ${sortDirection === "desc" ? styles.columnMenuActionActive : ""}`}
                    onClick={() => onSort(sortDirection === "desc" ? null : "desc")}
                  >
                    <ArrowDownAZ size={15} aria-hidden />
                    По убыванию
                  </button>
                </div>
              ) : null}

              {filterable ? (
                <div className={styles.columnMenuSection}>
                  <div className={styles.columnMenuSectionHead}>
                    <p className={styles.columnMenuSectionTitle}>Показывать</p>
                    <div className={styles.columnMenuQuickActions}>
                      <button type="button" className={styles.columnMenuLink} onClick={onSelectAll}>
                        Все
                      </button>
                      <button type="button" className={styles.columnMenuLink} onClick={onClearFilter}>
                        Сброс
                      </button>
                    </div>
                  </div>

                  {options.length > 8 ? (
                    <div className={styles.columnMenuSearchWrap}>
                      <Search size={14} className={styles.columnMenuSearchIcon} aria-hidden />
                      <input
                        type="text"
                        className={styles.columnMenuSearch}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Поиск значений…"
                        aria-label={`Поиск в ${label}`}
                      />
                    </div>
                  ) : null}

                  <div className={styles.columnMenuOptions}>
                    {filteredOptions.length === 0 ? (
                      <p className={styles.columnMenuEmpty}>Ничего не найдено</p>
                    ) : (
                      filteredOptions.map((option) => {
                        const checked = effectiveSelected.has(option.value);
                        return (
                          <div
                            key={`${header}-${option.value}`}
                            role="menuitemcheckbox"
                            aria-checked={checked}
                            className={styles.columnMenuOption}
                            onClick={() => onToggleValue(option.value)}
                          >
                            <span
                              className={styles.columnMenuOptionCheckbox}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <FormCheckbox
                                checked={checked}
                                aria-label={option.value}
                                onChange={() => onToggleValue(option.value)}
                              />
                            </span>
                            <span className={styles.columnMenuOptionLabel} title={option.value}>
                              {option.value}
                            </span>
                            <span className={styles.columnMenuOptionCount}>{option.count}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>,
            menuPlacement.portalRoot
          )
        : null}
    </div>
  );
}

type ShiftProgressSummaryProps = {
  stats: ProgressStats;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
};

function ShiftProgressSummary({
  stats,
  statusFilter,
  onStatusFilterChange,
}: ShiftProgressSummaryProps) {
  if (stats.total <= 0) return null;

  const segment = (count: number) =>
    stats.total > 0 ? Math.max(0, (count / stats.total) * 100) : 0;

  const toggleStatus = (next: StatusFilter) => {
    onStatusFilterChange(statusFilter === next ? "all" : next);
  };

  return (
    <section className={styles.progressSummary} aria-label="Сводка выполнения заданий">
      <div className={styles.progressSummaryHead}>
        <div>
          <h3 className={styles.progressSummaryTitle}>Сводка выполнения</h3>
          <p className={styles.progressSummaryHint}>
            {stats.checking > 0
              ? `${stats.checking} на проверке · `
              : ""}
            {stats.resolvedPercent}% выполнено полностью
          </p>
        </div>
        <div className={styles.progressSummaryTotal}>
          <span className={styles.progressSummaryTotalValue}>{stats.total}</span>
          <span className={styles.progressSummaryTotalLabel}>заданий</span>
        </div>
      </div>

      <div
        className={styles.progressBar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={stats.resolvedPercent}
        aria-label={`Выполнено полностью: ${stats.resolvedPercent}%`}
      >
        <div
          className={styles.progressSegmentResolved}
          style={{ width: `${segment(stats.resolved)}%` }}
        />
        <div
          className={styles.progressSegmentPartial}
          style={{ width: `${segment(stats.partial)}%` }}
        />
        <div
          className={styles.progressSegmentNotResolved}
          style={{ width: `${segment(stats.notResolved)}%` }}
        />
        <div
          className={styles.progressSegmentActive}
          style={{ width: `${segment(stats.active)}%` }}
        />
      </div>

      <div className={styles.progressStats} role="toolbar" aria-label="Фильтр по статусу выполнения">
        <button
          type="button"
          className={`${styles.progressStat} ${styles.progressStatActive} ${
            statusFilter === "active" ? styles.progressStatSelected : ""
          }`}
          aria-pressed={statusFilter === "active"}
          onClick={() => toggleStatus("active")}
        >
          <span className={styles.progressStatLabel}>Активные</span>
          <strong className={styles.progressStatValue}>{stats.active}</strong>
        </button>
        <button
          type="button"
          className={`${styles.progressStat} ${styles.progressStatResolved} ${
            statusFilter === "resolved" ? styles.progressStatSelected : ""
          }`}
          aria-pressed={statusFilter === "resolved"}
          onClick={() => toggleStatus("resolved")}
        >
          <Check size={14} aria-hidden />
          <span className={styles.progressStatLabel}>Выполнено</span>
          <strong className={styles.progressStatValue}>{stats.resolved}</strong>
        </button>
        <button
          type="button"
          className={`${styles.progressStat} ${styles.progressStatPartial} ${
            statusFilter === "partial" ? styles.progressStatSelected : ""
          }`}
          aria-pressed={statusFilter === "partial"}
          onClick={() => toggleStatus("partial")}
        >
          <AlertTriangle size={14} aria-hidden />
          <span className={styles.progressStatLabel}>Частично</span>
          <strong className={styles.progressStatValue}>{stats.partial}</strong>
        </button>
        <button
          type="button"
          className={`${styles.progressStat} ${styles.progressStatNotResolved} ${
            statusFilter === "not_resolved" ? styles.progressStatSelected : ""
          }`}
          aria-pressed={statusFilter === "not_resolved"}
          onClick={() => toggleStatus("not_resolved")}
        >
          <CircleX size={14} aria-hidden />
          <span className={styles.progressStatLabel}>Не выполнено</span>
          <strong className={styles.progressStatValue}>{stats.notResolved}</strong>
        </button>
      </div>
    </section>
  );
}

function buildTaskKey(context: TaskContext): string {
  return [
    context.taskType,
    context.nomenclature,
    context.problem.slice(0, 120),
    context.solution.slice(0, 80),
  ].join("::");
}

function buildInitialResultTexts(
  body: string[][],
  rowKinds: ShiftAssignmentRowKind[],
  colIndexByHeader: Map<string, number>
): Record<string, string> {
  const taskTypes = buildTaskTypesByRow(body, rowKinds);
  const resultColIndex = colIndexByHeader.get(RESULT_COLUMN_HEADER) ?? -1;
  const problemColIndex = colIndexByHeader.get("Проблема") ?? -1;
  const solutionColIndex = colIndexByHeader.get("Что сделать") ?? -1;
  const nomenclatureColIndex = colIndexByHeader.get("Номенклатура") ?? -1;
  const texts: Record<string, string> = {};

  if (resultColIndex < 0) return texts;

  body.forEach((row, index) => {
    if ((rowKinds[index] ?? "task") !== "task") return;
    const context: TaskContext = {
      taskType: taskTypes[index] ?? "",
      problem: row[problemColIndex] ?? "",
      solution: row[solutionColIndex] ?? "",
      nomenclature: row[nomenclatureColIndex] ?? "",
    };
    texts[buildTaskKey(context)] = row[resultColIndex] ?? "";
  });

  return texts;
}

type ShiftResultFieldProps = {
  value: string;
  evalState: ResultEvalState;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
};

function ShiftResultField({ value, evalState, onChange, onBlur }: ShiftResultFieldProps) {
  const [draft, setDraft] = useState(value);
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) {
      setDraft(value);
    }
  }, [value]);

  const cellClass = evalState.loading
    ? styles.resultCellLoading
    : evalState.status === "resolved"
      ? styles.resultCellResolved
      : evalState.status === "partial"
        ? styles.resultCellPartial
        : evalState.status === "not_resolved"
          ? styles.resultCellNotResolved
          : evalState.error
            ? styles.resultCellError
            : "";

  const statusTitle = evalState.loading
    ? "Проверка ответа…"
    : evalState.error
      ? evalState.error
      : evalState.comment || undefined;

  return (
    <div className={`${styles.resultCell} ${cellClass}`}>
      <div className={styles.resultInputWrap}>
        <textarea
          className={styles.resultInput}
          value={draft}
          rows={3}
          placeholder="Что сделали: звонок, дата, подтверждение…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          disabled={evalState.loading}
          onFocus={() => {
            editingRef.current = true;
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => {
            editingRef.current = false;
            const next = event.target.value;
            if (next !== value) onChange(next);
            onBlur(next);
          }}
        />
        <div className={styles.resultStatus} title={statusTitle} aria-live="polite">
          <ShiftEvalIndicator evalState={evalState} size="md" title={statusTitle} />
        </div>
      </div>
    </div>
  );
}

function TempShiftAssignmentViewer({
  open,
  embedded = false,
  loading,
  error,
  values,
  rowPriorities,
  rowKinds,
  meta,
  fileName,
  resultTexts: controlledResultTexts,
  onResultTextsChange,
  resultEvals: controlledResultEvals,
  onResultEvalsChange,
  onExport,
  onClose,
  onOpenShipmentSchedule,
  onOpenShipmentScheduleHover,
  shipmentScheduleAvailable = false,
  onManagerResultEvaluated,
}: Props) {
  const { user } = useAuth();
  const managerScope = useMemo(() => resolveShiftManagerScope(user), [user]);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>({});
  const [columnSort, setColumnSort] = useState<ColumnSortState>(null);
  const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null);
  const [internalResultTexts, setInternalResultTexts] = useState<Record<string, string>>({});
  const [internalResultEvals, setInternalResultEvals] = useState<Record<string, ResultEvalState>>({});
  const resultTexts = controlledResultTexts ?? internalResultTexts;
  const setResultTexts = onResultTextsChange ?? setInternalResultTexts;
  const resultEvals = controlledResultEvals ?? internalResultEvals;
  const setResultEvals = onResultEvalsChange ?? setInternalResultEvals;
  const lastEvaluatedRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setTypeFilter("all");
      setStatusFilter("all");
      setColumnFilters({});
      setColumnSort(null);
      setOpenColumnMenu(null);
    }
  }, [open]);

  const header = values[0] ?? [];
  const sourceBody = values.length > 1 ? values.slice(1) : [];

  const colIndexByHeader = useMemo(() => {
    const map = new Map<string, number>();
    header.forEach((title, index) => map.set(title, index));
    return map;
  }, [header]);

  const resultColIndex = colIndexByHeader.get(RESULT_COLUMN_HEADER) ?? -1;

  useEffect(() => {
    if (!open || sourceBody.length === 0 || controlledResultTexts !== undefined) return;
    const bodyRowKinds = rowKinds.slice(1);
    const initial = buildInitialResultTexts(sourceBody, bodyRowKinds, colIndexByHeader);
    setInternalResultTexts(initial);
    setInternalResultEvals({});
    lastEvaluatedRef.current = {};
  }, [open, values, rowKinds, colIndexByHeader, sourceBody.length, controlledResultTexts]);

  const visibleColumnIndices = useMemo(
    () =>
      header
        .map((title, index) => ({ title, index }))
        .filter(({ title }) => !HIDDEN_COLUMNS.has(title))
        .map(({ index }) => index),
    [header]
  );

  const visibleHeader = useMemo(
    () => visibleColumnIndices.map((index) => header[index] ?? ""),
    [header, visibleColumnIndices]
  );

  const numberColIndex = colIndexByHeader.get("№") ?? -1;

  const { types: taskTypes, counts: taskTypeCounts } = useMemo(
    () => collectTaskTypeStats(sourceBody, rowKinds),
    [sourceBody, rowKinds]
  );

  const filtered = useMemo(
    () => filterBodyRows(sourceBody, rowPriorities, rowKinds, typeFilter),
    [sourceBody, rowPriorities, rowKinds, typeFilter]
  );

  const progressStats = useMemo(
    () =>
      computeProgressStats(
        sourceBody,
        rowKinds.slice(1),
        resultEvals,
        colIndexByHeader
      ),
    [sourceBody, rowKinds, resultEvals, colIndexByHeader]
  );

  const statusFiltered = useMemo(
    () =>
      filterBodyByStatus(
        filtered.body,
        filtered.rowPriorities,
        filtered.rowKinds,
        statusFilter,
        resultEvals,
        colIndexByHeader
      ),
    [filtered.body, filtered.rowPriorities, filtered.rowKinds, statusFilter, resultEvals, colIndexByHeader]
  );

  const statusTaskTypesByRow = useMemo(
    () => buildTaskTypesByRow(statusFiltered.body, statusFiltered.rowKinds),
    [statusFiltered.body, statusFiltered.rowKinds]
  );

  const columnFilterOptions = useMemo(
    () =>
      collectColumnFilterOptions(
        statusFiltered.body,
        statusFiltered.rowKinds,
        visibleHeader,
        colIndexByHeader,
        statusTaskTypesByRow,
        resultTexts,
        managerScope
      ),
    [
      statusFiltered.body,
      statusFiltered.rowKinds,
      visibleHeader,
      colIndexByHeader,
      statusTaskTypesByRow,
      resultTexts,
      managerScope,
    ]
  );

  const columnFiltered = useMemo(
    () =>
      filterBodyByColumnFilters(
        statusFiltered.body,
        statusFiltered.rowPriorities,
        statusFiltered.rowKinds,
        columnFilters,
        colIndexByHeader,
        statusTaskTypesByRow,
        resultTexts
      ),
    [
      statusFiltered.body,
      statusFiltered.rowPriorities,
      statusFiltered.rowKinds,
      columnFilters,
      colIndexByHeader,
      statusTaskTypesByRow,
      resultTexts,
    ]
  );

  const columnFilterTaskTypesByRow = useMemo(
    () => buildTaskTypesByRow(columnFiltered.body, columnFiltered.rowKinds),
    [columnFiltered.body, columnFiltered.rowKinds]
  );

  const sortedRows = useMemo(
    () =>
      sortTasksWithinGroups(
        columnFiltered.body,
        columnFiltered.rowPriorities,
        columnFiltered.rowKinds,
        columnSort,
        colIndexByHeader,
        columnFilterTaskTypesByRow,
        resultTexts
      ),
    [
      columnFiltered.body,
      columnFiltered.rowPriorities,
      columnFiltered.rowKinds,
      columnSort,
      colIndexByHeader,
      columnFilterTaskTypesByRow,
      resultTexts,
    ]
  );

  const hasColumnFilters = Object.keys(columnFilters).length > 0;

  const handleToggleColumnValue = useCallback((header: string, value: string) => {
    setColumnFilters((prev) => {
      const allValues = (columnFilterOptions[header] ?? []).map((option) => option.value);
      const current = prev[header] ?? new Set(allValues);
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      if (next.size === allValues.length) {
        const { [header]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [header]: next };
    });
  }, [columnFilterOptions]);

  const handleSelectAllColumn = useCallback((header: string) => {
    setColumnFilters((prev) => {
      const { [header]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleClearColumnFilter = useCallback((header: string) => {
    setColumnFilters((prev) => ({ ...prev, [header]: new Set<string>() }));
  }, []);

  const handleColumnSort = useCallback((header: string, direction: SortDirection | null) => {
    if (!columnSupportsSort(header)) return;
    if (!direction) {
      setColumnSort((prev) => (prev?.header === header ? null : prev));
      return;
    }
    setColumnSort({ header, direction });
  }, []);

  const displayBody = useMemo(() => {
    const shouldRenumber =
      typeFilter !== "all" || statusFilter !== "all" || hasColumnFilters || columnSort !== null;
    return shouldRenumber
      ? withRenumberedTasks(sortedRows.body, sortedRows.rowKinds, numberColIndex)
      : sortedRows.body;
  }, [
    sortedRows.body,
    sortedRows.rowKinds,
    numberColIndex,
    typeFilter,
    statusFilter,
    hasColumnFilters,
    columnSort,
  ]);

  const displayPriorities = sortedRows.rowPriorities;
  const displayRowKinds = sortedRows.rowKinds;

  const taskTypesByRow = useMemo(
    () => buildTaskTypesByRow(displayBody, displayRowKinds),
    [displayBody, displayRowKinds]
  );

  const getTaskContext = useCallback(
    (row: string[], rowIndex: number): TaskContext =>
      buildTaskContextFromRow(row, taskTypesByRow[rowIndex] ?? "", colIndexByHeader),
    [colIndexByHeader, taskTypesByRow]
  );

  const handleResultChange = useCallback((taskKey: string, value: string) => {
    setResultTexts((prev) => ({ ...prev, [taskKey]: value }));
    setResultEvals((prev) => {
      const current = prev[taskKey];
      if (!current?.status && !current?.error) return prev;
      return { ...prev, [taskKey]: {} };
    });
  }, []);

  const handleResultBlur = useCallback(
    async (taskKey: string, context: TaskContext, textValue: string) => {
      await evaluateShiftTaskResult({
        taskKey,
        context,
        text: textValue,
        lastEvaluatedRef,
        setResultEvals,
        onManagerResultEvaluated,
      });
    },
    [onManagerResultEvaluated, setResultEvals]
  );

  const colCount = Math.max(visibleHeader.length, 1);
  const totalTaskCount =
    meta?.taskCount ?? taskTypes.reduce((sum, type) => sum + (taskTypeCounts[type] ?? 0), 0);

  if (!open && !embedded) return null;

  const panel = (
    <div
      className={`${styles.modal} ${embedded ? styles.modalEmbedded : ""}`}
      role="dialog"
      aria-modal={embedded ? undefined : "true"}
      aria-labelledby="temp-shift-assignment-title"
      onClick={(event) => event.stopPropagation()}
    >
        <div className={styles.header}>
          <div>
            <h2 id="temp-shift-assignment-title" className={styles.title}>
              {managerScope ? `Мои задания · ${managerScope}` : "Сменное задание"}
            </h2>
            <p className={styles.meta}>
              {meta
                ? `${meta.asOf} · неделя ${meta.weekPeriod} · ${meta.taskCount} заданий`
                : loading
                  ? "загрузка…"
                  : `${Math.max(values.length - 1, 0)} строк`}
              {meta && meta.taskCount > 0
                ? ` · срочно ${meta.urgentCount}, сегодня ${meta.todayCount}, неделя ${meta.weekCount}`
                : ""}
            </p>
          </div>
          <div className={styles.headerActions}>
            {shipmentScheduleAvailable && onOpenShipmentSchedule ? (
              <button
                type="button"
                className={styles.secondaryBtn}
                onMouseEnter={onOpenShipmentScheduleHover}
                onFocus={onOpenShipmentScheduleHover}
                onClick={onOpenShipmentSchedule}
              >
                <FlipHorizontal2 size={16} aria-hidden />
                Обновлённый график отгрузок
              </button>
            ) : null}
            <button
              type="button"
              className={styles.exportBtn}
              disabled={loading || Boolean(error) || values.length === 0}
              onClick={onExport}
            >
              <Download size={16} aria-hidden />
              Выгрузить в Excel
            </button>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingState}>
              <Loader2 className={styles.spinner} size={22} aria-hidden />
              <span>Загрузка сменного задания…</span>
            </div>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : values.length === 0 ? (
            <p className={styles.empty}>Сменное задание не сформировано.</p>
          ) : (
            <>
              {totalTaskCount > 0 ? (
                <ShiftProgressSummary
                  stats={progressStats}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                />
              ) : null}

              {taskTypes.length > 0 ? (
                <div className={styles.filters} role="toolbar" aria-label="Фильтр по типу задания">
                  <button
                    type="button"
                    className={`${styles.filterBadge} ${typeFilter === "all" ? styles.filterBadgeActive : ""}`}
                    onClick={() => setTypeFilter("all")}
                    aria-pressed={typeFilter === "all"}
                  >
                    Все
                    <span className={styles.filterCount}>{totalTaskCount}</span>
                  </button>
                  {taskTypes.map((taskType) => (
                    <button
                      key={taskType}
                      type="button"
                      className={`${styles.filterBadge} ${typeFilter === taskType ? styles.filterBadgeActive : ""}`}
                      onClick={() => setTypeFilter(taskType)}
                      aria-pressed={typeFilter === taskType}
                    >
                      {taskType}
                      <span className={styles.filterCount}>{taskTypeCounts[taskType] ?? 0}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className={styles.tableWrap} data-table-scroll>
                {displayBody.length === 0 ? (
                  <p className={styles.emptyFilter}>
                    {hasColumnFilters
                      ? "Нет заданий с выбранными значениями в колонках."
                      : statusFilter !== "all" && typeFilter !== "all"
                        ? "Нет заданий с выбранным типом и статусом."
                        : statusFilter !== "all"
                          ? "Нет заданий с выбранным статусом выполнения."
                          : "Нет заданий выбранного типа."}
                  </p>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        {visibleHeader.map((title) => (
                          <th key={`h-${title}`} className={columnClass(title)}>
                            {!columnSupportsFilter(title, managerScope) ? (
                              headerLabel(title)
                            ) : (
                              <ColumnHeaderMenu
                                header={title}
                                label={headerLabel(title)}
                                options={columnFilterOptions[title] ?? []}
                                selectedValues={columnFilters[title] ?? null}
                                sortable={columnSupportsSort(title)}
                                filterable={columnSupportsFilter(title, managerScope)}
                                sortDirection={
                                  columnSort?.header === title ? columnSort.direction : null
                                }
                                isOpen={openColumnMenu === title}
                                onToggle={() =>
                                  setOpenColumnMenu((current) => (current === title ? null : title))
                                }
                                onClose={() => setOpenColumnMenu(null)}
                                onSort={(direction) => handleColumnSort(title, direction)}
                                onToggleValue={(value) => handleToggleColumnValue(title, value)}
                                onSelectAll={() => handleSelectAllColumn(title)}
                                onClearFilter={() => handleClearColumnFilter(title)}
                              />
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayBody.map((row, rowIndex) => {
                        const priority = displayPriorities[rowIndex] ?? null;
                        const rowKind = displayRowKinds[rowIndex] ?? "task";
                        const rowClass =
                          rowKind === "group"
                            ? styles.groupHeaderRow
                            : `${priorityClass(priority)} ${rowKind === "empty" ? styles.emptyRow : ""}`;
                        const isSingleCellRow =
                          (rowKind === "group" || rowKind === "empty" || row.length === 1) &&
                          colCount > 1;
                        const taskContext = getTaskContext(row, rowIndex);
                        const taskKey = buildTaskKey(taskContext);

                        return (
                          <tr key={`r-${rowIndex}`} className={rowClass}>
                            {isSingleCellRow ? (
                              <td colSpan={colCount}>{row[0] ?? ""}</td>
                            ) : (
                              visibleColumnIndices.map((colIndex) => {
                                const columnHeader = header[colIndex] ?? "";
                                if (
                                  rowKind === "task" &&
                                  columnHeader === RESULT_COLUMN_HEADER &&
                                  resultColIndex >= 0
                                ) {
                                  return (
                                    <td
                                      key={`c-${rowIndex}-${colIndex}`}
                                      className={`${columnClass(columnHeader)} ${styles.resultTd}`}
                                    >
                                      <ShiftResultField
                                        value={resultTexts[taskKey] ?? row[resultColIndex] ?? ""}
                                        evalState={resultEvals[taskKey] ?? {}}
                                        onChange={(value) => handleResultChange(taskKey, value)}
                                        onBlur={(value) => void handleResultBlur(taskKey, taskContext, value)}
                                      />
                                    </td>
                                  );
                                }

                                return (
                                  <td
                                    key={`c-${rowIndex}-${colIndex}`}
                                    className={columnClass(columnHeader)}
                                    title={row[colIndex] ?? ""}
                                  >
                                    {row[colIndex] ?? ""}
                                  </td>
                                );
                              })
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>

        {!loading && !error && values.length > 0 ? (
          <div className={styles.footer}>
            <span className={styles.footerHint}>
              {meta?.taskCount
                ? `Заполните «Результат» и уберите фокус — LM Studio проверит выполнение задания`
                : "Файл для Excel готов после анализа"}
            </span>
            <span className={styles.footerFile}>{fileName}</span>
          </div>
        ) : null}
      </div>
  );

  if (embedded) return panel;

  return (
    <div
      className={styles.overlay}
      data-column-menu-portal
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {panel}
    </div>
  );
}

export default memo(TempShiftAssignmentViewer);
