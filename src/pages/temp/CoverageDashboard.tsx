import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CalendarDays,
  Download,
  Layers,
  ListFilter,
  Package,
  RefreshCw,
  ShieldCheck,
  Siren,
  X
} from "lucide-react";
import styles from "../DocumentAnalysisAgent.module.css";
import { exportTableToExcel } from "@/utils/exportTableToExcel";
import type { StockBalancesCache } from "./useAveonReferenceCache";
import stockStyles from "./TempStockBalancesModal.module.css";
import {
  buildStockWarehousesByName,
  normalizeStockNomenclatureName,
  StockWarehouseCell,
  StockWarehousePopover,
  warehouseExportLabel,
  type WarehouseBreakdown,
} from "./stockWarehouseUi";
import ShiftTaskBoard, { ShiftTasksNewDayNotice, type ShiftTaskBoardProps } from "./ShiftTaskBoard";

type CoverageDashboardSide = "products" | "nomenclatures" | "tasks" | "manager_results";

export type ManagerCompletionTask = Record<string, unknown>;

export type ManagerCompletionStats = {
  total: number;
  resolved: number;
  incomplete: number;
  partial: number;
  notResolved: number;
  active: number;
  resolvedPercent: number;
};

export type ManagerCompletionReport = {
  id: string;
  managerName: string;
  reportDate: string;
  reportStatus: "submitted" | "missing" | "in_progress";
  regionLabel: string;
  daysWithReports?: number;
  stats: ManagerCompletionStats;
  tasks: ManagerCompletionTask[];
  incompleteTasks: ManagerCompletionTask[];
  emailSentTo: string;
  emailSentAt: string | null;
  liveUpdatedAt?: string | null;
};

export type ManagerCompletionRoster = {
  total: number;
  submitted: number;
  inProgress: number;
  missing: number;
};

export type ManagerCompletionDashboard = {
  reportDate: string;
  periodMode?: "day" | "range" | "all";
  periodLabel?: string;
  dateFrom?: string;
  dateTo?: string;
  daysInPeriod?: number;
  submittedShiftDays?: number;
  expectedShiftDays?: number;
  liveMode: boolean;
  summary: ManagerCompletionStats;
  roster: ManagerCompletionRoster;
  managers: ManagerCompletionReport[];
};

export type ManagerCompletionDateEntry = {
  reportDate: string;
  reportsCount: number;
  rosterTotal: number;
  hasLive?: boolean;
};

export type ManagerTasksNotice = {
  kind: "new_day";
  previousValidDate?: string | null;
  today?: string;
};

export type ExecutiveReportMode = "day" | "range" | "all";

export type ExecutiveReportDownloadParams = {
  mode: ExecutiveReportMode;
  reportDate?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type ManagerResultsBundle = {
  dashboard: ManagerCompletionDashboard | null;
  dateFrom: string;
  dateTo: string;
  selectedDate: string;
  availableDates: ManagerCompletionDateEntry[];
  today: string;
  loading: boolean;
  error: string | null;
  executiveReportLoading?: boolean;
  executiveReportError?: string | null;
  onPeriodChange: (dateFrom: string, dateTo: string) => void;
  onRetry: () => void;
  onRefresh: () => void;
  onExecutiveReportDownload?: (params: ExecutiveReportDownloadParams) => void;
};

export type CoveragePeriodKey = "day" | "week" | "month";
export type CoverageTileKey = "all" | "green" | "yellow" | "red";

export type CoverageMaterialShortage = {
  name: string;
  plan: number;
  stock: number;
  expected: number;
  shortage: number;
  materialKind?: string;
  materialKindLabel?: string;
  materialKindConfidence?: string;
  materialKindReason?: string;
  optional?: boolean;
};

export type CoverageRow = {
  name: string;
  plan: number;
  fact: number;
  covered: number;
  assemblableQty?: number;
  status: string;
  available?: number;
  materialKind?: string;
  materialKindLabel?: string;
  materialKindConfidence?: string;
  materialKindReason?: string;
  optional?: boolean;
  materials?: CoverageMaterialShortage[];
  shortages?: CoverageMaterialShortage[];
};

export type CoverageSidePayload = {
  rows: CoverageRow[];
  tiles: Record<CoverageTileKey, number> & {
    plan_total?: number;
    fact_total?: number;
    covered_total?: number;
    green_plan_total?: number;
    yellow_plan_total?: number;
    red_plan_total?: number;
    green_covered_total?: number;
    yellow_covered_total?: number;
    red_covered_total?: number;
    optional?: number;
    optional_plan_total?: number;
    optional_covered_total?: number;
  };
};

export type CoveragePeriodPayload = {
  key: CoveragePeriodKey | "custom";
  label: string;
  days: string[];
  products: CoverageSidePayload;
  nomenclatures: CoverageSidePayload;
};

export type CoverageDashboardPayload = {
  asOf: string;
  scheduleMonth: string;
  defaultPeriod: CoveragePeriodKey;
  periods: Record<CoveragePeriodKey, CoveragePeriodPayload>;
};

type CoverageTileMeta = {
  key: CoverageTileKey;
  label: string;
  tone: "default" | "success" | "danger" | "critical";
  hint: string;
};

type CoverageTileExplanation = {
  title: string;
  shows: string;
  counts: string;
};

function tileExplanation(
  tile: CoverageTileMeta,
  side: "products" | "nomenclatures"
): CoverageTileExplanation {
  if (side === "products") {
    switch (tile.key) {
      case "all":
        return {
          title: "План изделий",
          shows: "Сколько изделий запланировано выпустить за выбранный период и сколько разных изделий есть в плане.",
          counts: "Основное число — сумма плана в штуках. Подпись — количество разных изделий с планом больше нуля."
        };
      case "green":
        return {
          title: "Готово к выпуску",
          shows: "Сколько изделий можно выпустить полностью готовыми по всем обязательным номенклатурам без спорных допущений.",
          counts: "Берём изделия, у которых материалов хватает на весь план строго по спецификации. Основное число — план этих изделий в штуках."
        };
      case "yellow":
        return {
          title: "Частично собрать",
          shows: "Изделия, у которых материалов хватает не на весь план, но часть номенклатур уже есть.",
          counts:
            "Основное число — сколько полуфабрикатов можно собрать сейчас по спецификации (узкое место по номенклатурам). Подпись — сколько видов изделий в частичном статусе."
        };
      case "red":
        return {
          title: "Без покрытия",
          shows: "Изделия, у которых по всем номенклатурам спецификации нет остатка и нет поступлений на период.",
          counts: "Берём изделия с полностью нулевым материальным покрытием. Основное число — их план в штуках."
        };
      default:
        return { title: tile.label, shows: tile.hint, counts: "" };
    }
  }

  switch (tile.key) {
    case "all":
      return {
        title: "Потребность номенклатур",
        shows: "Сколько обязательной номенклатуры требуется производству за выбранный период.",
        counts: "Основное число — суммарная потребность. Подпись — количество разных номенклатур с ненулевым планом."
      };
    case "green":
      return {
        title: "Номенклатуры хватает",
        shows: "Сколько потребности закрыто полностью остатками и поступлениями.",
        counts: "Берём позиции, у которых доступное количество не меньше потребности. Основное число — полностью закрытая потребность."
      };
    case "yellow":
      return {
        title: "Номенклатуры хватает частично",
        shows: "Сколько потребности можно покрыть частично: материал есть, но его меньше, чем требуется.",
        counts: "Основное число — реально покрытое количество по частичным позициям. Подпись — сколько разных номенклатур в дефиците."
      };
    case "red":
      return {
        title: "Номенклатур нет",
        shows: "Сколько потребности не имеет покрытия вообще: нет остатка и нет поступлений на период.",
        counts: "Берём позиции с нулевым покрытием. Основное число — их потребность; подпись — количество разных номенклатур."
      };
    default:
      return { title: tile.label, shows: tile.hint, counts: "" };
  }
}

const COVERAGE_TILES: CoverageTileMeta[] = [
  { key: "all", label: "С планом", tone: "default", hint: "Изделия или номенклатуры с ненулевым планом" },
  { key: "green", label: "Обеспечено", tone: "success", hint: "План полностью покрыт остатками и поступлениями" },
  { key: "yellow", label: "Частично", tone: "danger", hint: "Покрытие есть, но меньше плана" },
  { key: "red", label: "Не обеспечено", tone: "critical", hint: "Нет покрытия или нет спецификации" }
];

function coverageTileSurfaceClass(key: CoverageTileKey): string {
  switch (key) {
    case "green":
      return styles.coverageTileSurfaceGreen;
    case "yellow":
      return styles.coverageTileSurfacePartial;
    case "red":
      return styles.coverageTileSurfaceRed;
    default:
      return styles.coverageTileSurfacePlan;
  }
}

function coverageTileIconClass(key: CoverageTileKey): string {
  switch (key) {
    case "green":
      return styles.coverageTileIconGreen;
    case "yellow":
      return styles.coverageTileIconPartial;
    case "red":
      return styles.coverageTileIconRed;
    default:
      return styles.coverageTileIconPlan;
  }
}

function coverageTileLabel(tileKey: CoverageTileKey, side: CoverageSideKey): string {
  if (side === "products") {
    return {
      all: "План изделий",
      green: "Можно выпустить",
      yellow: "Частично собрать",
      red: "Нет покрытия"
    }[tileKey];
  }
  return {
    all: "Потребность",
    green: "Хватает",
    yellow: "Частично хватает",
    red: "Нет номенклатур"
  }[tileKey];
}

const PERIOD_OPTIONS: Array<{ key: CoveragePeriodKey; label: string }> = [
  { key: "day", label: "За день" },
  { key: "week", label: "За неделю" },
  { key: "month", label: "За месяц" }
];

type CoverageSideKey = "products" | "nomenclatures";

type CoverageViewTransition = { kind: "period" } | { kind: "section" };

function createEmptyExplainedTiles(): Record<CoverageSideKey, CoverageTileKey | null> {
  return { products: null, nomenclatures: null };
}

function coverageTransitionClass(transition: CoverageViewTransition | null): string {
  if (!transition) return "";
  return transition.kind === "period" ? styles.coverageAnimPeriod : styles.coverageAnimSection;
}

const COVERAGE_PERIOD_TRANSITION_MS = 440;
const COVERAGE_SECTION_TRANSITION_MS = 340;
const COVERAGE_FLIP_TRANSITION_MS = 620;

function isCoverageFlipTransition(
  from: CoverageDashboardSide,
  to: CoverageDashboardSide
): boolean {
  return (
    (from === "products" && to === "nomenclatures") ||
    (from === "nomenclatures" && to === "products")
  );
}

function sectionPanelContentKey(
  panel: "coverage" | "tasks" | "manager_results",
  isActive: boolean,
  animKey: number
): string {
  if (!isActive || animKey === 0) return panel;
  return `${panel}-${animKey}`;
}

function formatCoveragePeriodLabel(
  days: string[],
  formatDate: (iso: string | null | undefined) => string
): string | null {
  if (!days.length) return null;
  if (days.length === 1) return formatDate(days[0]);
  return `${formatDate(days[0])}–${formatDate(days[days.length - 1])}`;
}

function resolveCoverageScheduleBounds(dashboard: CoverageDashboardPayload): { min: string; max: string } {
  const monthDays = dashboard.periods.month?.days ?? [];
  if (monthDays.length > 0) {
    return { min: monthDays[0], max: monthDays[monthDays.length - 1] };
  }
  const [year, month] = dashboard.scheduleMonth.split("-");
  if (!year || !month) {
    const fallback = dashboard.asOf || "2026-01-01";
    return { min: fallback, max: fallback };
  }
  const monthNum = Number.parseInt(month, 10);
  const lastDay = new Date(Number.parseInt(year, 10), monthNum, 0).getDate();
  return {
    min: `${year}-${month}-01`,
    max: `${year}-${month}-${String(lastDay).padStart(2, "0")}`
  };
}

function rangeFromPeriodDays(days: string[] | undefined): { from: string; to: string } | null {
  if (!days?.length) return null;
  return { from: days[0], to: days[days.length - 1] };
}

function matchingPresetPeriod(
  dashboard: CoverageDashboardPayload,
  dateFrom: string,
  dateTo: string
): CoveragePeriodKey | null {
  for (const key of ["day", "week", "month"] as const) {
    const range = rangeFromPeriodDays(dashboard.periods[key]?.days);
    if (range && range.from === dateFrom && range.to === dateTo) return key;
  }
  return null;
}

function mapCoverageDashboard(raw: unknown): CoverageDashboardPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const periodsRaw = data.periods;
  if (!periodsRaw || typeof periodsRaw !== "object") return null;

  const periods = {} as Record<CoveragePeriodKey, CoveragePeriodPayload>;
  for (const periodKey of ["day", "week", "month"] as const) {
    const period = (periodsRaw as Record<string, unknown>)[periodKey];
    if (!period || typeof period !== "object") continue;
    const side = (sideRaw: unknown): CoverageSidePayload => {
      const sideData =
        sideRaw && typeof sideRaw === "object" ? (sideRaw as Record<string, unknown>) : {};
      const tilesRaw =
        sideData.tiles && typeof sideData.tiles === "object"
          ? (sideData.tiles as Record<string, unknown>)
          : {};
      const rowsRaw = Array.isArray(sideData.rows) ? sideData.rows : [];
      return {
        tiles: {
          all: Number(tilesRaw.all ?? 0),
          green: Number(tilesRaw.green ?? 0),
          yellow: Number(tilesRaw.yellow ?? 0),
          red: Number(tilesRaw.red ?? 0),
          plan_total: Number(tilesRaw.plan_total ?? 0),
          fact_total: Number(tilesRaw.fact_total ?? 0),
          covered_total: Number(tilesRaw.covered_total ?? 0),
          green_plan_total: Number(tilesRaw.green_plan_total ?? 0),
          yellow_plan_total: Number(tilesRaw.yellow_plan_total ?? 0),
          red_plan_total: Number(tilesRaw.red_plan_total ?? 0),
          green_covered_total: Number(tilesRaw.green_covered_total ?? 0),
          yellow_covered_total: Number(tilesRaw.yellow_covered_total ?? 0),
          red_covered_total: Number(tilesRaw.red_covered_total ?? 0),
          optional: Number(tilesRaw.optional ?? 0),
          optional_plan_total: Number(tilesRaw.optional_plan_total ?? 0),
          optional_covered_total: Number(tilesRaw.optional_covered_total ?? 0)
        },
        rows: rowsRaw.flatMap((row) => {
          if (!row || typeof row !== "object") return [];
          const item = row as Record<string, unknown>;
          const name = String(item.name ?? "");
          if (!name) return [];
          const mapped: CoverageRow = {
            name,
            plan: Number(item.plan ?? 0),
            fact: Number(item.fact ?? 0),
            covered: Number(item.covered ?? 0),
            assemblableQty:
              item.assemblableQty !== undefined ? Number(item.assemblableQty ?? 0) : undefined,
            status: String(item.status ?? "")
          };
          mapped.materialKind = String(item.materialKind ?? "");
          mapped.materialKindLabel = String(item.materialKindLabel ?? "");
          mapped.materialKindConfidence = String(item.materialKindConfidence ?? "");
          mapped.materialKindReason = String(item.materialKindReason ?? "");
          mapped.optional = Boolean(item.optional ?? false);
          if (item.available !== undefined && item.available !== null) {
            mapped.available = Number(item.available);
          }
          if (Array.isArray(item.materials)) {
            mapped.materials = mapCoverageMaterialLines(item.materials);
          }
          if (Array.isArray(item.shortages)) {
            mapped.shortages = mapCoverageMaterialLines(item.shortages);
          }
          if (!mapped.materials?.length && mapped.shortages?.length) {
            mapped.materials = mapped.shortages;
          }
          return [mapped];
        })
      };
    };
    periods[periodKey] = {
      key: periodKey,
      label: String((period as Record<string, unknown>).label ?? periodKey),
      days: Array.isArray((period as Record<string, unknown>).days)
        ? ((period as Record<string, unknown>).days as unknown[]).map(String)
        : [],
      products: side((period as Record<string, unknown>).products),
      nomenclatures: side((period as Record<string, unknown>).nomenclatures)
    };
  }

  return {
    asOf: String(data.as_of ?? ""),
    scheduleMonth: String(data.schedule_month ?? ""),
    defaultPeriod: "day",
    periods
  };
}

function mapCoverageSide(sideRaw: unknown): CoverageSidePayload {
  const sideData = sideRaw && typeof sideRaw === "object" ? (sideRaw as Record<string, unknown>) : {};
  const tilesRaw =
    sideData.tiles && typeof sideData.tiles === "object"
      ? (sideData.tiles as Record<string, unknown>)
      : {};
  const rowsRaw = Array.isArray(sideData.rows) ? sideData.rows : [];
  return {
    tiles: {
      all: Number(tilesRaw.all ?? 0),
      green: Number(tilesRaw.green ?? 0),
      yellow: Number(tilesRaw.yellow ?? 0),
      red: Number(tilesRaw.red ?? 0),
      plan_total: Number(tilesRaw.plan_total ?? 0),
      fact_total: Number(tilesRaw.fact_total ?? 0),
      covered_total: Number(tilesRaw.covered_total ?? 0),
      green_plan_total: Number(tilesRaw.green_plan_total ?? 0),
      yellow_plan_total: Number(tilesRaw.yellow_plan_total ?? 0),
      red_plan_total: Number(tilesRaw.red_plan_total ?? 0),
      green_covered_total: Number(tilesRaw.green_covered_total ?? 0),
      yellow_covered_total: Number(tilesRaw.yellow_covered_total ?? 0),
      red_covered_total: Number(tilesRaw.red_covered_total ?? 0),
      optional: Number(tilesRaw.optional ?? 0),
      optional_plan_total: Number(tilesRaw.optional_plan_total ?? 0),
      optional_covered_total: Number(tilesRaw.optional_covered_total ?? 0)
    },
    rows: rowsRaw.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>;
      const name = String(item.name ?? "");
      if (!name) return [];
      const mapped: CoverageRow = {
        name,
        plan: Number(item.plan ?? 0),
        fact: Number(item.fact ?? 0),
        covered: Number(item.covered ?? 0),
        assemblableQty: item.assemblableQty !== undefined ? Number(item.assemblableQty ?? 0) : undefined,
        status: String(item.status ?? "")
      };
      mapped.materialKind = String(item.materialKind ?? "");
      mapped.materialKindLabel = String(item.materialKindLabel ?? "");
      mapped.materialKindConfidence = String(item.materialKindConfidence ?? "");
      mapped.materialKindReason = String(item.materialKindReason ?? "");
      mapped.optional = Boolean(item.optional ?? false);
      if (item.available !== undefined && item.available !== null) {
        mapped.available = Number(item.available);
      }
      if (Array.isArray(item.materials)) {
        mapped.materials = mapCoverageMaterialLines(item.materials);
      }
      if (Array.isArray(item.shortages)) {
        mapped.shortages = mapCoverageMaterialLines(item.shortages);
      }
      if (!mapped.materials?.length && mapped.shortages?.length) {
        mapped.materials = mapped.shortages;
      }
      return [mapped];
    })
  };
}

export function parseCoveragePeriod(raw: unknown): CoveragePeriodPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const period = raw as Record<string, unknown>;
  const keyRaw = String(period.key ?? "custom");
  const key: CoveragePeriodPayload["key"] =
    keyRaw === "day" || keyRaw === "week" || keyRaw === "month" ? keyRaw : "custom";
  return {
    key,
    label: String(period.label ?? key),
    days: Array.isArray(period.days) ? period.days.map(String) : [],
    products: mapCoverageSide(period.products),
    nomenclatures: mapCoverageSide(period.nomenclatures)
  };
}

function formatRuDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

function formatQty(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value - Math.round(value)) < 1e-9) {
    return String(Math.round(value));
  }
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatCompactQty(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн`;
  }
  if (Math.abs(value) >= 10_000) {
    return `${(value / 1_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} тыс`;
  }
  return formatQty(value);
}

function tileMetricValue(
  tileKey: CoverageTileKey,
  tiles: CoverageSidePayload["tiles"],
  side: CoverageSideKey
): { value: string; subLabel: string } {
  const count = tiles[tileKey] ?? 0;
  const itemLabel = side === "products" ? "видов изделий" : "позиций";
  const unitLabel = side === "products" ? "шт" : "ед.";

  if (tileKey === "all") {
    return {
      value: formatCompactQty(tiles.plan_total ?? 0),
      subLabel: `план · ${count} ${itemLabel}`
    };
  }

  if (tileKey === "green") {
    return {
      value: formatCompactQty(tiles.green_plan_total ?? tiles.covered_total ?? 0),
      subLabel: `${count} ${itemLabel} · полностью`
    };
  }

  if (tileKey === "yellow") {
    return {
      value: formatCompactQty(tiles.yellow_covered_total ?? 0),
      subLabel:
        side === "products"
          ? `${unitLabel} полуфабрикатов · ${count} ${itemLabel}`
          : `${unitLabel} можно сейчас · ${count} ${itemLabel}`
    };
  }

  if (tileKey === "red") {
    return {
      value: formatCompactQty(tiles.red_plan_total ?? 0),
      subLabel: `без покрытия · ${count} ${itemLabel}`
    };
  }

  return {
    value: String(count),
    subLabel: itemLabel
  };
}

function tileIcon(key: CoverageTileKey) {
  switch (key) {
    case "green":
      return ShieldCheck;
    case "yellow":
      return AlertTriangle;
    case "red":
      return Siren;
    default:
      return Package;
  }
}

function filterRows(rows: CoverageRow[], tile: CoverageTileKey): CoverageRow[] {
  if (tile === "all") {
    return rows.filter((row) => row.plan > 0);
  }
  return rows.filter((row) => row.status === tile);
}

function mapCoverageMaterialLines(raw: unknown): CoverageMaterialShortage[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const part = entry as Record<string, unknown>;
    const name = String(part.name ?? "");
    if (!name) return [];
    return [
      {
        name,
        plan: Number(part.plan ?? 0),
        stock: Number(part.stock ?? 0),
        expected: Number(part.expected ?? 0),
        shortage: Number(part.shortage ?? 0),
        materialKind: String(part.materialKind ?? ""),
        materialKindLabel: String(part.materialKindLabel ?? ""),
        materialKindConfidence: String(part.materialKindConfidence ?? ""),
        materialKindReason: String(part.materialKindReason ?? ""),
        optional: Boolean(part.optional ?? false)
      }
    ];
  });
}

function productMaterialLines(row: CoverageRow): CoverageMaterialShortage[] {
  if (row.materials?.length) return row.materials;
  return row.shortages ?? [];
}

function productShortageLines(row: CoverageRow): CoverageMaterialShortage[] {
  const materials = productMaterialLines(row);
  if (row.materials?.length) {
    return materials.filter((item) => item.shortage > 1e-9);
  }
  return materials;
}

function statusLabel(status: string): string {
  switch (status) {
    case "green":
      return "Обеспечено";
    case "yellow":
      return "Частично";
    case "red":
      return "Не обеспечено";
    default:
      return "—";
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "green":
      return styles.coverageStatusGreen;
    case "yellow":
      return styles.coverageStatusYellow;
    case "red":
      return styles.coverageStatusRed;
    default:
      return styles.coverageStatusNeutral;
  }
}

export function parseCoverageDashboard(raw: unknown): CoverageDashboardPayload | null {
  return mapCoverageDashboard(raw);
}

type MaterialCoverageStatusKey = "green" | "yellow" | "red";

const MATERIAL_COVERAGE_STATUS_OPTIONS: Array<{ key: MaterialCoverageStatusKey; label: string }> = [
  { key: "green", label: "Обеспечено" },
  { key: "yellow", label: "Частично" },
  { key: "red", label: "Не обеспечено" }
];

const MATERIAL_COVERAGE_STATUS_ORDER: Record<MaterialCoverageStatusKey | "none", number> = {
  green: 0,
  yellow: 1,
  red: 2,
  none: 3
};

function materialCoverageStatus(material: CoverageMaterialShortage): MaterialCoverageStatusKey | "none" {
  if (material.plan <= 1e-12) return "none";
  const available = material.stock + material.expected;
  if (available + 1e-9 >= material.plan) return "green";
  if (available > 1e-12) return "yellow";
  return "red";
}

function sanitizeCoverageExportFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim().slice(0, 80) || "izdelie";
}

type CoverageProductBomModalProps = {
  row: CoverageRow;
  periodLabel: string;
  tileLabel: string;
  stockByName: Map<string, WarehouseBreakdown[]>;
  onClose: () => void;
};

function lookupMaterialWarehouses(
  stockByName: Map<string, WarehouseBreakdown[]>,
  materialName: string
): WarehouseBreakdown[] {
  return stockByName.get(normalizeStockNomenclatureName(materialName)) ?? [];
}

function CoverageProductBomModal({
  row,
  periodLabel,
  tileLabel,
  stockByName,
  onClose
}: CoverageProductBomModalProps) {
  const materials = productMaterialLines(row);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<MaterialCoverageStatusKey>>(
    () => new Set(MATERIAL_COVERAGE_STATUS_OPTIONS.map((option) => option.key))
  );
  const [expandedWarehouseKey, setExpandedWarehouseKey] = useState<string | null>(null);
  const [warehousePopoverPos, setWarehousePopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [statusFilterMenuPos, setStatusFilterMenuPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const statusFilterBtnRef = useRef<HTMLButtonElement | null>(null);
  const statusFilterMenuRef = useRef<HTMLDivElement | null>(null);

  const materialsWithStatus = useMemo(
    () =>
      materials.map((material) => ({
        material,
        status: materialCoverageStatus(material)
      })),
    [materials]
  );

  const filteredMaterials = useMemo(() => {
    const filtered = materialsWithStatus.filter(
      (entry) => entry.status !== "none" && selectedStatuses.has(entry.status)
    );
    return [...filtered].sort((left, right) => {
      const byStatus =
        MATERIAL_COVERAGE_STATUS_ORDER[left.status] -
        MATERIAL_COVERAGE_STATUS_ORDER[right.status];
      if (byStatus !== 0) return byStatus;
      return left.material.name.localeCompare(right.material.name, "ru");
    });
  }, [materialsWithStatus, selectedStatuses]);

  const selectedStatusCount = selectedStatuses.size;
  const statusFilterActive =
    selectedStatusCount > 0 &&
    selectedStatusCount < MATERIAL_COVERAGE_STATUS_OPTIONS.length;

  const toggleMaterialStatus = useCallback((status: MaterialCoverageStatusKey) => {
    setSelectedStatuses((current) => {
      const next = new Set(current);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const closeStatusFilter = useCallback(() => {
    setStatusFilterOpen(false);
    setStatusFilterMenuPos(null);
  }, []);

  const toggleStatusFilter = useCallback(() => {
    if (statusFilterOpen) {
      closeStatusFilter();
      return;
    }
    const rect = statusFilterBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setStatusFilterMenuPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setStatusFilterOpen(true);
  }, [closeStatusFilter, statusFilterOpen]);

  const closeWarehousePopover = useCallback(() => {
    setExpandedWarehouseKey(null);
    setWarehousePopoverPos(null);
  }, []);

  const toggleWarehousePopover = useCallback((rowKey: string, anchor: DOMRect) => {
    if (expandedWarehouseKey === rowKey) {
      closeWarehousePopover();
      return;
    }
    setExpandedWarehouseKey(rowKey);
    setWarehousePopoverPos({
      top: anchor.bottom + 6,
      left: anchor.left,
    });
  }, [closeWarehousePopover, expandedWarehouseKey]);

  const expandedWarehouseMaterial = useMemo(() => {
    if (!expandedWarehouseKey) return null;
    const entry = filteredMaterials.find(
      ({ material }) => material.name === expandedWarehouseKey
    );
    if (!entry) return null;
    return {
      name: entry.material.name,
      warehouses: lookupMaterialWarehouses(stockByName, entry.material.name),
    };
  }, [expandedWarehouseKey, filteredMaterials, stockByName]);

  const handleExport = useCallback(() => {
    if (filteredMaterials.length === 0) return;
    exportTableToExcel(
      `obespechennost_${sanitizeCoverageExportFileName(row.name)}.csv`,
      [
        { key: "name", title: "Номенклатура" },
        { key: "warehouses", title: "Склады" },
        { key: "plan", title: "План" },
        { key: "stock", title: "Остаток" },
        { key: "expected", title: "Ожид. поступление" },
        { key: "shortage", title: "Не хватает" },
        { key: "status", title: "Статус" }
      ],
      filteredMaterials.map(({ material, status }) => ({
        name: material.name,
        warehouses: warehouseExportLabel(lookupMaterialWarehouses(stockByName, material.name)),
        plan: material.plan,
        stock: material.stock,
        expected: material.expected,
        shortage: material.shortage,
        status: statusLabel(status)
      }))
    );
  }, [filteredMaterials, row.name, stockByName]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (expandedWarehouseKey) {
          closeWarehousePopover();
          return;
        }
        if (statusFilterOpen) {
          closeStatusFilter();
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeStatusFilter, closeWarehousePopover, expandedWarehouseKey, onClose, statusFilterOpen]);

  useEffect(() => {
    closeWarehousePopover();
  }, [closeWarehousePopover, row.name, selectedStatuses]);

  useEffect(() => {
    closeStatusFilter();
  }, [closeStatusFilter, row.name]);

  useEffect(() => {
    if (!statusFilterOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (statusFilterBtnRef.current?.contains(target)) return;
      if (statusFilterMenuRef.current?.contains(target)) return;
      closeStatusFilter();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [closeStatusFilter, statusFilterOpen]);

  return (
    <div
      className={styles.coverageProductModalBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={styles.coverageProductModal}
        role="dialog"
        aria-modal="true"
        aria-label={`Спецификация изделия ${row.name}`}
      >
        <header className={styles.coverageProductModalHead}>
          <div>
            <p className={styles.coverageProductModalEyebrow}>
              {periodLabel} · {tileLabel}
            </p>
            <h3>{row.name}</h3>
            <p>
              План {formatQty(row.plan)} · обеспечено {formatQty(row.covered)} ·{" "}
              <span className={`${styles.coverageStatusBadge} ${statusClass(row.status)}`}>
                {statusLabel(row.status)}
              </span>
            </p>
          </div>
          <div className={styles.coverageProductModalActions}>
            {materials.length > 0 ? (
              <>
                <div className={styles.coverageProductModalFilterWrap}>
                  <button
                    ref={statusFilterBtnRef}
                    type="button"
                    className={`${styles.coverageProductModalFilterBtn} ${
                      statusFilterActive ? styles.coverageProductModalFilterBtnActive : ""
                    }`}
                    aria-haspopup="menu"
                    aria-expanded={statusFilterOpen}
                    onClick={toggleStatusFilter}
                  >
                    <ListFilter size={15} strokeWidth={2.2} aria-hidden="true" />
                    <span>Статус</span>
                    {statusFilterActive ? (
                      <span className={styles.coverageProductModalFilterCount}>
                        {selectedStatusCount}/{MATERIAL_COVERAGE_STATUS_OPTIONS.length}
                      </span>
                    ) : null}
                    <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  className={styles.coverageProductModalExportBtn}
                  disabled={filteredMaterials.length === 0}
                  onClick={handleExport}
                >
                  <Download size={15} strokeWidth={2.2} aria-hidden="true" />
                  <span>Выгрузить в Excel</span>
                </button>
              </>
            ) : null}
            <button
              type="button"
              className={styles.coverageProductModalClose}
              aria-label="Закрыть"
              onClick={onClose}
            >
              <X size={18} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
        </header>

        {materials.length === 0 ? (
          <p className={styles.coverageProductModalEmpty}>
            Для этого изделия не найдена спецификация или номенклатуры не определены.
          </p>
        ) : selectedStatusCount === 0 ? (
          <p className={styles.coverageProductModalEmpty}>
            Выберите хотя бы один статус в фильтре, чтобы показать номенклатуры.
          </p>
        ) : filteredMaterials.length === 0 ? (
          <p className={styles.coverageProductModalEmpty}>
            По выбранным статусам нет номенклатур в спецификации.
          </p>
        ) : (
          <div className={styles.coverageProductModalTableWrap}>
            <p className={styles.coverageProductModalLead}>
              Номенклатуры спецификации для плана {formatQty(row.plan)} за период
              {statusFilterActive ? ` · показано ${filteredMaterials.length}` : ""}
            </p>
            <table className={styles.coverageProductModalTable}>
              <thead>
                <tr>
                  <th>Номенклатура</th>
                  <th>Склады</th>
                  <th>План</th>
                  <th>Остаток</th>
                  <th>Ожид. поступление</th>
                  <th>Не хватает</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map(({ material, status: materialStatus }) => {
                  const hasShortage = material.shortage > 1e-9;
                  const warehouses = lookupMaterialWarehouses(stockByName, material.name);
                  return (
                    <tr
                      key={material.name}
                      className={hasShortage ? styles.coverageBomRowShortage : undefined}
                    >
                      <td className={styles.coverageProblemMaterialName}>{material.name}</td>
                      <td className={stockStyles.warehouseCell}>
                        <StockWarehouseCell
                          warehouses={warehouses}
                          rowKey={material.name}
                          isExpanded={expandedWarehouseKey === material.name}
                          onToggle={toggleWarehousePopover}
                        />
                      </td>
                      <td>{formatQty(material.plan)}</td>
                      <td>{formatQty(material.stock)}</td>
                      <td>{formatQty(material.expected)}</td>
                      <td className={hasShortage ? styles.coverageShortageValue : undefined}>
                        {formatQty(material.shortage)}
                      </td>
                      <td>
                        <span
                          className={`${styles.coverageStatusBadge} ${statusClass(materialStatus)}`}
                        >
                          {statusLabel(materialStatus)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {expandedWarehouseMaterial ? (
          <StockWarehousePopover
            nomenclatureName={expandedWarehouseMaterial.name}
            warehouses={expandedWarehouseMaterial.warehouses}
            position={warehousePopoverPos}
            onClose={closeWarehousePopover}
          />
        ) : null}
      </section>
      {statusFilterOpen && statusFilterMenuPos ? (
        <div
          ref={statusFilterMenuRef}
          className={styles.coverageProductModalFilterMenu}
          role="menu"
          style={{ top: statusFilterMenuPos.top, right: statusFilterMenuPos.right }}
        >
          <div className={styles.coverageProductModalFilterMenuHead}>
            <strong>Показать по статусу</strong>
            <span>
              {filteredMaterials.length}/{materialsWithStatus.length}
            </span>
          </div>
          <div className={styles.coverageProductModalFilterMenuList}>
            {MATERIAL_COVERAGE_STATUS_OPTIONS.map((option) => {
              const checked = selectedStatuses.has(option.key);
              return (
                <label
                  key={option.key}
                  className={styles.coverageProductModalFilterMenuItem}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMaterialStatus(option.key)}
                  />
                  <span
                    className={`${styles.coverageStatusBadge} ${statusClass(option.key)}`}
                  >
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
          <div className={styles.coverageProductModalFilterMenuActions}>
            <button
              type="button"
              onClick={() =>
                setSelectedStatuses(
                  new Set(MATERIAL_COVERAGE_STATUS_OPTIONS.map((option) => option.key))
                )
              }
            >
              Все
            </button>
            <button type="button" onClick={() => setSelectedStatuses(new Set())}>
              Снять
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type CoverageDetailTableProps = {
  tile: CoverageTileMeta;
  side: "products" | "nomenclatures";
  rows: CoverageRow[];
  periodLabel: string;
  stockByName: Map<string, WarehouseBreakdown[]>;
  animateIn?: boolean;
};

type CoverageProblemMaterial = CoverageMaterialShortage & {
  products: string[];
};

function CoverageDetailTable({
  tile,
  side,
  rows,
  periodLabel,
  stockByName,
  animateIn = false
}: CoverageDetailTableProps) {
  const sideLabel = side === "products" ? "изделия" : "номенклатуры";
  const tileLabel = coverageTileLabel(tile.key, side);
  const explanation = tileExplanation(tile, side);
  const showAvailable = side === "nomenclatures";
  const clickableProducts = side === "products";
  const [productModalRow, setProductModalRow] = useState<CoverageRow | null>(null);
  const [problemMenuOpen, setProblemMenuOpen] = useState(false);
  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [selectedProblemProducts, setSelectedProblemProducts] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedProblemWarehouseKey, setExpandedProblemWarehouseKey] = useState<string | null>(
    null
  );
  const [problemWarehousePopoverPos, setProblemWarehousePopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    setProductModalRow(null);
    setProblemMenuOpen(false);
    setProblemModalOpen(false);
    setExpandedProblemWarehouseKey(null);
    setProblemWarehousePopoverPos(null);
  }, [tile.key, side, periodLabel]);

  const closeProblemWarehousePopover = useCallback(() => {
    setExpandedProblemWarehouseKey(null);
    setProblemWarehousePopoverPos(null);
  }, []);

  const toggleProblemWarehousePopover = useCallback((rowKey: string, anchor: DOMRect) => {
    if (expandedProblemWarehouseKey === rowKey) {
      closeProblemWarehousePopover();
      return;
    }
    setExpandedProblemWarehouseKey(rowKey);
    setProblemWarehousePopoverPos({
      top: anchor.bottom + 6,
      left: anchor.left,
    });
  }, [closeProblemWarehousePopover, expandedProblemWarehouseKey]);

  useEffect(() => {
    if (side !== "products" || tile.key !== "red") {
      setSelectedProblemProducts(new Set());
      return;
    }
    setSelectedProblemProducts(new Set(rows.map((row) => row.name)));
  }, [rows, side, tile.key]);

  const activeProductModalRow = useMemo(() => {
    if (!productModalRow) return null;
    return rows.find((row) => row.name === productModalRow.name) ?? null;
  }, [productModalRow, rows]);

  const openProductModal = useCallback((row: CoverageRow) => {
    setProductModalRow(row);
  }, []);

  const closeProductModal = useCallback(() => {
    setProductModalRow(null);
  }, []);

  const toggleProblemProduct = useCallback((productName: string) => {
    setSelectedProblemProducts((current) => {
      const next = new Set(current);
      if (next.has(productName)) {
        next.delete(productName);
      } else {
        next.add(productName);
      }
      return next;
    });
  }, []);

  const problemMaterials = useMemo<CoverageProblemMaterial[]>(() => {
    if (side !== "products" || tile.key !== "red") return [];
    const byName = new Map<string, CoverageProblemMaterial>();
    for (const row of rows) {
      if (!selectedProblemProducts.has(row.name)) continue;
      for (const shortage of productShortageLines(row)) {
        const current = byName.get(shortage.name);
        if (current) {
          current.plan += shortage.plan;
          current.shortage += shortage.shortage;
          current.stock = Math.max(current.stock, shortage.stock);
          current.expected = Math.max(current.expected, shortage.expected);
          current.optional = Boolean(current.optional || shortage.optional);
          current.materialKind = current.materialKind || shortage.materialKind;
          current.materialKindLabel = current.materialKindLabel || shortage.materialKindLabel;
          current.materialKindConfidence =
            current.materialKindConfidence || shortage.materialKindConfidence;
          current.materialKindReason = current.materialKindReason || shortage.materialKindReason;
          if (!current.products.includes(row.name)) {
            current.products.push(row.name);
          }
        } else {
          byName.set(shortage.name, {
            ...shortage,
            products: [row.name]
          });
        }
      }
    }
    return [...byName.values()].sort((left, right) => right.shortage - left.shortage);
  }, [rows, selectedProblemProducts, side, tile.key]);

  const expandedProblemWarehouseMaterial = useMemo(() => {
    if (!expandedProblemWarehouseKey) return null;
    const item = problemMaterials.find((entry) => entry.name === expandedProblemWarehouseKey);
    if (!item) return null;
    return {
      name: item.name,
      warehouses: lookupMaterialWarehouses(stockByName, item.name),
    };
  }, [expandedProblemWarehouseKey, problemMaterials, stockByName]);

  const showProblemSelector = side === "products" && tile.key === "red" && rows.length > 0;
  const selectedProblemCount = selectedProblemProducts.size;

  const expandHint = clickableProducts
    ? "Нажмите на изделие, чтобы открыть спецификацию с остатками, поступлениями и дефицитами."
    : null;

  return (
    <div
      className={`${styles.coverageDetailBlock} ${animateIn ? styles.coverageDetailAnim : ""}`}
      role="region"
      aria-label={`${tileLabel}: ${sideLabel}`}
    >
      <div className={styles.coverageDetailHeader}>
        <div>
          <h3 className={styles.coverageDetailTitle}>
            {tileLabel} · {sideLabel}
          </h3>
          <p className={styles.coverageDetailHint}>
            {periodLabel}. {expandHint ?? explanation.shows}
          </p>
        </div>
        <div className={styles.coverageDetailHeaderActions}>
          {showProblemSelector ? (
            <div className={styles.coverageProblemMenuWrap}>
              <button
                type="button"
                className={styles.coverageProblemMenuBtn}
                aria-haspopup="menu"
                aria-expanded={problemMenuOpen}
                onClick={() => setProblemMenuOpen((open) => !open)}
              >
                <ClipboardList size={15} strokeWidth={2.2} aria-hidden="true" />
                <span>Проблемные номенклатуры</span>
              </button>
              {problemMenuOpen ? (
                <div className={styles.coverageProblemMenu} role="menu">
                  <div className={styles.coverageProblemMenuHead}>
                    <strong>Выберите изделия</strong>
                    <span>
                      {selectedProblemCount}/{rows.length}
                    </span>
                  </div>
                  <div className={styles.coverageProblemMenuList}>
                    {rows.map((row) => {
                      const checked = selectedProblemProducts.has(row.name);
                      return (
                        <label key={row.name} className={styles.coverageProblemMenuItem}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleProblemProduct(row.name)}
                          />
                          <span>{row.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className={styles.coverageProblemMenuActions}>
                    <button
                      type="button"
                      onClick={() => setSelectedProblemProducts(new Set(rows.map((row) => row.name)))}
                    >
                      Все
                    </button>
                    <button type="button" onClick={() => setSelectedProblemProducts(new Set())}>
                      Снять
                    </button>
                    <button
                      type="button"
                      className={styles.coverageProblemMenuPrimary}
                      disabled={selectedProblemCount === 0}
                      onClick={() => {
                        setProblemModalOpen(true);
                        setProblemMenuOpen(false);
                      }}
                    >
                      Показать
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <span className={styles.coverageDetailCount}>
            {rows.length > 0 ? `${rows.length} позиций` : "Нет позиций"}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className={styles.coverageDetailEmpty}>В этой категории нет позиций за выбранный период.</p>
      ) : (
        <div className={styles.coverageDetailTableWrap}>
          <table className={styles.coverageDetailTable}>
            <thead>
              <tr>
                <th>{side === "products" ? "Изделие" : "Номенклатура"}</th>
                <th>План</th>
                <th>Факт</th>
                <th>Обеспечено</th>
                {showAvailable ? <th>Доступно</th> : null}
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                  <tr
                    key={row.name}
                    className={clickableProducts ? styles.coverageDetailRowExpandable : undefined}
                    onClick={clickableProducts ? () => openProductModal(row) : undefined}
                  >
                      <td className={styles.coverageDetailNameCell} title={row.name}>
                        {clickableProducts ? (
                          <button
                            type="button"
                            className={styles.coverageDetailExpandBtn}
                            aria-haspopup="dialog"
                            onClick={(event) => {
                              event.stopPropagation();
                              openProductModal(row);
                            }}
                          >
                            <ChevronRight
                              size={14}
                              strokeWidth={2.2}
                              className={styles.coverageDetailExpandIcon}
                              aria-hidden="true"
                            />
                            <span>{row.name}</span>
                          </button>
                        ) : (
                          <span>{row.name}</span>
                        )}
                      </td>
                      <td>{formatQty(row.plan)}</td>
                      <td>{formatQty(row.fact)}</td>
                      <td
                        title={
                          side === "products"
                            ? "Сколько полуфабрикатов можно собрать по спецификации"
                            : undefined
                        }
                      >
                        {formatQty(row.covered)}
                      </td>
                      {showAvailable ? <td>{formatQty(row.available ?? 0)}</td> : null}
                      <td>
                        <span className={`${styles.coverageStatusBadge} ${statusClass(row.status)}`}>
                          {statusLabel(row.status)}
                        </span>
                      </td>
                    </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeProductModalRow ? (
        <CoverageProductBomModal
          row={activeProductModalRow}
          periodLabel={periodLabel}
          tileLabel={tileLabel}
          stockByName={stockByName}
          onClose={closeProductModal}
        />
      ) : null}

      {problemModalOpen ? (
        <div
          className={styles.coverageProblemModalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setProblemModalOpen(false);
          }}
        >
          <section
            className={styles.coverageProblemModal}
            role="dialog"
            aria-modal="true"
            aria-label="Проблемные номенклатуры по выбранным изделиям"
          >
            <header className={styles.coverageProblemModalHead}>
              <div>
                <p className={styles.coverageProblemModalEyebrow}>{periodLabel} · не обеспечено</p>
                <h3>Проблемные номенклатуры без дублей</h3>
                <p>
                  Выбрано изделий: {selectedProblemCount}. Позиции сгруппированы по названию
                  номенклатуры, дефицит и план суммированы.
                </p>
              </div>
              <button
                type="button"
                className={styles.coverageProblemModalClose}
                aria-label="Закрыть"
                onClick={() => setProblemModalOpen(false)}
              >
                <X size={18} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </header>
            {problemMaterials.length === 0 ? (
              <p className={styles.coverageProblemModalEmpty}>
                По выбранным изделиям нет расшифрованных недостающих номенклатур. Возможно,
                у изделия не найдена спецификация.
              </p>
            ) : (
              <div className={styles.coverageProblemModalTableWrap}>
                <table className={styles.coverageProblemModalTable}>
                  <thead>
                    <tr>
                      <th>Номенклатура</th>
                      <th>Склады</th>
                      <th>Изделия</th>
                      <th>План</th>
                      <th>Остаток</th>
                      <th>Ожид.</th>
                      <th>Не хватает</th>
                    </tr>
                  </thead>
                  <tbody>
                    {problemMaterials.map((item) => {
                      const warehouses = lookupMaterialWarehouses(stockByName, item.name);
                      return (
                        <tr key={item.name}>
                          <td className={styles.coverageProblemMaterialName}>{item.name}</td>
                          <td className={stockStyles.warehouseCell}>
                            <StockWarehouseCell
                              warehouses={warehouses}
                              rowKey={item.name}
                              isExpanded={expandedProblemWarehouseKey === item.name}
                              onToggle={toggleProblemWarehousePopover}
                            />
                          </td>
                          <td>{item.products.join("; ")}</td>
                          <td>{formatQty(item.plan)}</td>
                          <td>{formatQty(item.stock)}</td>
                          <td>{formatQty(item.expected)}</td>
                          <td className={styles.coverageShortageValue}>{formatQty(item.shortage)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {expandedProblemWarehouseMaterial ? (
              <StockWarehousePopover
                nomenclatureName={expandedProblemWarehouseMaterial.name}
                warehouses={expandedProblemWarehouseMaterial.warehouses}
                position={problemWarehousePopoverPos}
                onClose={closeProblemWarehousePopover}
              />
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

type CoverageTileExplainPanelProps = {
  tile: CoverageTileMeta;
  side: CoverageSideKey;
  onClose: () => void;
};

function CoverageTileBackFace({ tile, side, onClose }: CoverageTileExplainPanelProps) {
  const explanation = tileExplanation(tile, side);
  const sideLabel = side === "products" ? "изделия" : "номенклатуры";

  return (
    <div
      className={`${styles.riskAnalyticsTile} ${styles.riskTileFace} ${styles.riskTileFaceBack} ${coverageTileSurfaceClass(tile.key)} ${styles.coverageTileBackFace}`}
      role="group"
      aria-label={`${explanation.title}: пояснение`}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <div className={styles.coverageTileExplainHeader}>
        <strong>{explanation.title}</strong>
        <button
          type="button"
          className={styles.coverageTileExplainClose}
          aria-label="Вернуть плитку"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        >
          <X size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        className={styles.coverageTileBackBody}
        aria-label="Вернуть плитку"
        onClick={onClose}
      >
        <p className={styles.coverageTileExplainLine}>
          <span className={styles.coverageTileExplainLabel}>Показывает</span>
          {explanation.shows}
        </p>
        <p className={styles.coverageTileExplainLine}>
          <span className={styles.coverageTileExplainLabel}>Как считается</span>
          {explanation.counts}
        </p>
      </button>
      <p className={styles.coverageTileExplainMeta}>Режим: {sideLabel}</p>
    </div>
  );
}

function splitTasksByResolved(tasks: ManagerCompletionTask[]) {
  const resolved: ManagerCompletionTask[] = [];
  const remaining: ManagerCompletionTask[] = [];
  for (const task of tasks) {
    if (taskValue(task, "status") === "resolved") {
      resolved.push(task);
    } else {
      remaining.push(task);
    }
  }
  return { resolved, remaining };
}

type ManagerTaskTileFilter = "total" | "resolved" | "remaining";

function getFilteredManagerTasks(
  manager: ManagerCompletionReport,
  filter: ManagerTaskTileFilter,
  reportKind: "live" | "submitted"
): ManagerCompletionTask[] {
  const { resolved, remaining } = splitTasksByResolved(manager.tasks);
  if (filter === "total") return manager.tasks;
  if (filter === "resolved") return resolved;
  if (reportKind === "submitted" && manager.incompleteTasks.length > 0) {
    return manager.incompleteTasks;
  }
  return remaining;
}

function managerTaskFilterTitle(filter: ManagerTaskTileFilter, reportKind: "live" | "submitted"): string {
  if (filter === "total") return "Все задания";
  if (filter === "resolved") return "Выполненные задания";
  return reportKind === "live" ? "Осталось сделать" : "Невыполненные задания и основания";
}

function managerTaskFilterEmpty(filter: ManagerTaskTileFilter, reportKind: "live" | "submitted"): string {
  if (filter === "total") return "Заданий в отчёте нет.";
  if (filter === "resolved") {
    return reportKind === "live"
      ? "Выполненных заданий пока нет."
      : "Выполненных заданий в отчёте нет.";
  }
  return reportKind === "live"
    ? "Все задания закрыты — менеджер может завершить смену."
    : "Незакрытых заданий с основаниями нет.";
}

function ManagerResultTiles({
  stats,
  filter,
  remainingLabel,
  onFilterChange
}: {
  stats: ManagerCompletionStats;
  filter: ManagerTaskTileFilter;
  remainingLabel: string;
  onFilterChange: (next: ManagerTaskTileFilter) => void;
}) {
  const tiles: Array<{ key: ManagerTaskTileFilter; label: string; value: number; valueClass?: string }> = [
    { key: "total", label: "Всего", value: stats.total },
    {
      key: "resolved",
      label: "Выполнено",
      value: stats.resolved,
      valueClass: styles.managerResultsSuccess
    },
    {
      key: "remaining",
      label: remainingLabel,
      value: stats.incomplete,
      valueClass: styles.managerResultsDanger
    }
  ];

  return (
    <div className={styles.managerResultTiles} role="tablist" aria-label="Фильтр заданий">
      {tiles.map((tile) => (
        <button
          key={tile.key}
          type="button"
          role="tab"
          aria-selected={filter === tile.key}
          className={`${styles.managerResultTile} ${styles.managerResultTileButton} ${
            filter === tile.key ? styles.managerResultTileActive : ""
          }`}
          onClick={() => onFilterChange(tile.key)}
        >
          <span>{tile.label}</span>
          <strong className={tile.valueClass}>{tile.value}</strong>
        </button>
      ))}
    </div>
  );
}

function taskValue(task: ManagerCompletionTask, key: string): string {
  const value = task[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function managerResultStatusLabel(status: string): string {
  switch (status) {
    case "resolved":
      return "Выполнена";
    case "partial":
      return "Частично выполнена";
    case "not_resolved":
      return "Не выполнена";
    case "active":
      return "Активная задача";
    default:
      return status || "—";
  }
}

function managerTaskPriorityLabel(priority: string): string {
  switch (priority) {
    case "urgent":
      return "Срочная задача";
    case "today":
      return "На сегодня";
    case "week":
      return "На неделю";
    default:
      return priority || "—";
  }
}

function formatManagerTaskDeadline(deadline: string): string {
  const value = deadline.trim();
  if (!value) return "";
  return `Обязательно до ${value}`;
}

function formatManagerTaskDeficit(task: ManagerCompletionTask): string {
  const deficit = taskValue(task, "deficit").trim();
  if (!deficit) return "";
  const unit = taskValue(task, "unit").trim();
  const hasUnitSuffix = /^\d[\d\s.,]*\s+[A-Za-zА-Яа-яёЁ%/]+/.test(deficit);
  if (hasUnitSuffix) {
    return `Дефицит: ${deficit}`;
  }
  if (unit) {
    return `Дефицит: ${deficit} ${unit}`;
  }
  return `Дефицит: ${deficit}`;
}

function managerTaskPriorityClass(priority: string): string {
  switch (priority) {
    case "urgent":
      return styles.managerResultTaskModalChipUrgent;
    case "today":
      return styles.managerResultTaskModalChipToday;
    default:
      return "";
  }
}

function managerReportStatusLabel(status: ManagerCompletionReport["reportStatus"]): string {
  switch (status) {
    case "in_progress":
      return "Смена в работе";
    case "submitted":
      return "Смена завершена";
    default:
      return "Смена не завершена";
  }
}

function ManagerResultTaskModal({
  task,
  manager,
  formatDate,
  onClose
}: {
  task: ManagerCompletionTask;
  manager: ManagerCompletionReport;
  formatDate: (iso: string | null | undefined) => string;
  onClose: () => void;
}) {
  const status = taskValue(task, "status");
  const tone = managerResultStatusTone(status);
  const priority = taskValue(task, "priority");
  const shiftDate = taskValue(task, "shift_date");
  const problem = taskValue(task, "problem");
  const solution = taskValue(task, "solution");
  const resultText = taskValue(task, "result_text");
  const evalComment = taskValue(task, "eval_comment");
  const reason = taskValue(task, "reason");
  const deadline = taskValue(task, "deadline");
  const taskType = taskValue(task, "task_type");
  const nomenclature = taskValue(task, "nomenclature") || "Задание";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className={styles.managerResultTaskModalBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={styles.managerResultTaskModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-result-task-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.managerResultTaskModalHead}>
          <div className={styles.managerResultTaskModalHeadMain}>
            <p className={styles.managerResultTaskModalEyebrow}>{taskType || "Задание смены"}</p>
            <h3 id="manager-result-task-modal-title">{nomenclature}</h3>
            <div className={styles.managerResultTaskModalChips}>
              <span
                className={`${styles.managerResultStatusPill} ${managerResultStatusPillClass(tone)} ${styles.managerResultTaskModalStatusPill}`}
              >
                {managerResultStatusLabel(status)}
              </span>
              {priority ? (
                <span
                  className={`${styles.managerResultTaskModalChip} ${managerTaskPriorityClass(priority)}`}
                >
                  {managerTaskPriorityLabel(priority)}
                </span>
              ) : null}
              {deadline ? (
                <span className={styles.managerResultTaskModalChip}>
                  {formatManagerTaskDeadline(deadline)}
                </span>
              ) : null}
              {taskValue(task, "deficit") ? (
                <span className={styles.managerResultTaskModalChip}>
                  {formatManagerTaskDeficit(task)}
                </span>
              ) : null}
              {shiftDate ? (
                <span className={styles.managerResultTaskModalChip}>
                  Смена {formatDate(shiftDate)}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className={styles.managerResultTaskModalClose}
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X size={24} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.managerResultTaskModalBody}>
          <article className={styles.managerResultTaskModalCard}>
            <p className={styles.managerResultTaskModalSectionLabel}>Исполнитель</p>
            <div className={styles.managerResultTaskModalExecutor}>
              <div>
                <strong>{manager.managerName}</strong>
                {manager.regionLabel ? (
                  <span className={styles.managerResultTaskModalExecutorRegion}>
                    {manager.regionLabel}
                  </span>
                ) : null}
              </div>
              <span className={styles.managerResultTaskModalExecutorMeta}>
                {managerReportStatusLabel(manager.reportStatus)}
                {shiftDate
                  ? ` · смена ${formatDate(shiftDate)}`
                  : manager.reportDate
                    ? ` · ${formatDate(manager.reportDate)}`
                    : ""}
              </span>
            </div>
          </article>

          <div className={styles.managerResultTaskModalSection}>
            <p className={styles.managerResultTaskModalSectionLabel}>Проблема</p>
            <p className={styles.managerResultTaskModalSectionText}>{problem || "—"}</p>
          </div>

          <div className={styles.managerResultTaskModalSection}>
            <p className={styles.managerResultTaskModalSectionLabel}>Что сделать</p>
            <p className={styles.managerResultTaskModalSectionText}>{solution || "—"}</p>
          </div>

          <div
            className={`${styles.managerResultTaskModalSection} ${styles.managerResultTaskModalSectionHighlight}`}
          >
            <p className={styles.managerResultTaskModalSectionLabel}>Результат работы менеджера</p>
            <p className={styles.managerResultTaskModalSectionText}>
              {resultText || "Менеджер ещё не зафиксировал результат по этому заданию."}
            </p>
            {evalComment ? (
              <p className={styles.managerResultTaskModalEval}>
                <span>Оценка системы:</span> {evalComment}
              </p>
            ) : null}
          </div>

          {reason && status !== "resolved" ? (
            <div className={`${styles.managerResultTaskModalSection} ${styles.managerResultTaskModalSectionReason}`}>
              <p className={styles.managerResultTaskModalSectionLabel}>
                Основание невыполнения
              </p>
              <blockquote className={styles.managerResultTaskModalReason}>{reason}</blockquote>
            </div>
          ) : null}
        </div>
      </section>
    </div>,
    document.body
  );
}

function ManagerProgressRing({
  stats,
  missing = false
}: {
  stats: ManagerCompletionStats;
  missing?: boolean;
}) {
  if (missing) {
    return (
      <div className={`${styles.managerResultRing} ${styles.managerResultRingMissing}`} aria-label="Отчёт не сдан">
        <strong>—</strong>
        <span>нет отчёта</span>
      </div>
    );
  }

  const percent = Math.max(0, Math.min(100, stats.resolvedPercent || 0));
  return (
    <div
      className={styles.managerResultRing}
      style={{ "--manager-progress": `${percent}%` } as CSSProperties}
      aria-label={`Успеваемость ${percent}%`}
    >
      <strong>{percent}%</strong>
      <span>успеваемость</span>
    </div>
  );
}

function addIsoDays(iso: string, delta: number): string {
  const base = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(base.getTime())) return iso;
  base.setDate(base.getDate() + delta);
  return base.toISOString().slice(0, 10);
}

function formatWeekdayShort(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU", { weekday: "short" });
}

function startOfIsoWeek(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function startOfIsoMonth(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatExecutiveReportRangeLabel(from: string, to: string): string {
  const fromDate = new Date(`${from}T12:00:00`);
  const toDate = new Date(`${to}T12:00:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return `${from} — ${to}`;
  const sameYear = fromDate.getFullYear() === toDate.getFullYear();
  const fromLabel = fromDate.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" })
  });
  const toLabel = toDate.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  return `${fromLabel} — ${toLabel}`;
}

const EXECUTIVE_REPORT_PRESETS = [
  { key: "week", label: "Эта неделя" },
  { key: "prev-week", label: "Прошлая неделя" },
  { key: "month", label: "Этот месяц" },
  { key: "30d", label: "30 дней" }
] as const;

function formatManagerResultsPeriodLabel(
  from: string,
  to: string,
  formatDate: (iso: string | null | undefined) => string
): string {
  if (from === to) {
    return `${formatDate(from)}, ${formatWeekdayShort(from)}`;
  }
  return formatExecutiveReportRangeLabel(from, to);
}

function countReportsInRange(
  availableDates: ManagerCompletionDateEntry[],
  from: string,
  to: string
): number {
  if (!from || !to || from > to) return 0;
  return availableDates.filter(
    (entry) => entry.reportDate >= from && entry.reportDate <= to && entry.reportsCount > 0
  ).length;
}

function ExecutiveReportBar({
  bundle,
  formatDate
}: {
  bundle: ManagerResultsBundle;
  formatDate: (iso: string | null | undefined) => string;
}) {
  const isSingleDay = bundle.dateFrom === bundle.dateTo;
  const isPeriodMode = !isSingleDay;
  const daysWithReportsInRange = useMemo(
    () => countReportsInRange(bundle.availableDates, bundle.dateFrom, bundle.dateTo),
    [bundle.availableDates, bundle.dateFrom, bundle.dateTo]
  );
  const earliestReportDate = useMemo(() => {
    if (bundle.availableDates.length === 0) return bundle.today;
    return bundle.availableDates.reduce(
      (earliest, entry) => (entry.reportDate < earliest ? entry.reportDate : earliest),
      bundle.availableDates[0].reportDate
    );
  }, [bundle.availableDates, bundle.today]);

  const buttonLabel = useMemo(() => {
    if (bundle.executiveReportLoading) return "Формируем…";
    return `Сформировать Excel · ${formatManagerResultsPeriodLabel(
      bundle.dateFrom,
      bundle.dateTo,
      formatDate
    )}`;
  }, [bundle.dateFrom, bundle.dateTo, bundle.executiveReportLoading, formatDate]);

  const handleDownload = () => {
    if (!bundle.onExecutiveReportDownload || bundle.executiveReportLoading) return;
    if (isSingleDay) {
      bundle.onExecutiveReportDownload({ mode: "day", reportDate: bundle.dateFrom });
      return;
    }
    bundle.onExecutiveReportDownload({
      mode: "range",
      dateFrom: bundle.dateFrom,
      dateTo: bundle.dateTo
    });
  };

  const handleDownloadAll = () => {
    if (!bundle.onExecutiveReportDownload || bundle.executiveReportLoading) return;
    bundle.onExecutiveReportDownload({ mode: "all" });
  };

  return (
    <div className={styles.managerResultsActionsBar}>
      <div className={styles.managerResultsActionsMain}>
        <div className={styles.managerResultsActionsHead}>
          <p className={styles.managerResultsActionsTitle}>Сводный отчёт руководителя</p>
          <p className={styles.managerResultsActionsHint}>
            Краткая управленческая сводка: KPI, работа менеджеров, обеспеченность производства и TOP-риски.
          </p>
        </div>

        <div className={styles.managerResultsReportModePanel}>
          <p className={styles.managerResultsReportModeSummary}>
            {isPeriodMode ? (
              <>
                За период{" "}
                <strong>
                  {formatManagerResultsPeriodLabel(bundle.dateFrom, bundle.dateTo, formatDate)}
                </strong>
              </>
            ) : (
              <>
                За день{" "}
                <strong>
                  {formatDate(bundle.dateFrom)}, {formatWeekdayShort(bundle.dateFrom)}
                </strong>
              </>
            )}
          </p>
          <p className={styles.managerResultsReportModeMeta}>
            {isPeriodMode
              ? daysWithReportsInRange > 0
                ? `${daysWithReportsInRange} ${
                    daysWithReportsInRange === 1
                      ? "день"
                      : daysWithReportsInRange < 5
                        ? "дня"
                        : "дней"
                  } с отчётами менеджеров в выбранном диапазоне. Excel формируется за тот же период, что и дашборд.`
                : "В выбранном диапазоне пока нет закрытых смен — отчёт всё равно можно сформировать."
              : "Синхронизировано с периодом в панели выше. Обеспеченность — на этот же день."}
          </p>
        </div>
      </div>

      <div className={styles.managerResultsReportActions}>
        {bundle.onExecutiveReportDownload ? (
          <button
            type="button"
            className={styles.managerResultsReportBtn}
            disabled={bundle.executiveReportLoading}
            onClick={handleDownload}
          >
            {buttonLabel}
          </button>
        ) : null}
        {bundle.onExecutiveReportDownload ? (
          <button
            type="button"
            className={styles.managerResultsReportAllBtn}
            disabled={bundle.executiveReportLoading}
            onClick={handleDownloadAll}
            title={`Все смены с ${formatDate(earliestReportDate)} по ${formatDate(bundle.today)}`}
          >
            Всё время
          </button>
        ) : null}
      </div>
    </div>
  );
}

function managerResultStatusTone(status: string): "success" | "danger" | "warning" | "muted" {
  switch (status) {
    case "resolved":
      return "success";
    case "partial":
      return "warning";
    case "not_resolved":
      return "danger";
    case "active":
      return "muted";
    default:
      return "muted";
  }
}

function managerResultStatusPillClass(tone: ReturnType<typeof managerResultStatusTone>): string {
  switch (tone) {
    case "success":
      return styles.managerResultStatusPill_success;
    case "warning":
      return styles.managerResultStatusPill_warning;
    case "danger":
      return styles.managerResultStatusPill_danger;
    default:
      return styles.managerResultStatusPill_muted;
  }
}

function ManagerResultsPeriodPicker({
  bundle,
  formatDate
}: {
  bundle: ManagerResultsBundle;
  formatDate: (iso: string | null | undefined) => string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(bundle.dateFrom);
  const [draftTo, setDraftTo] = useState(bundle.dateTo);

  useEffect(() => {
    if (menuOpen) return;
    setDraftFrom(bundle.dateFrom);
    setDraftTo(bundle.dateTo);
  }, [bundle.dateFrom, bundle.dateTo, menuOpen]);

  const rangeInvalid = Boolean(draftFrom && draftTo && draftFrom > draftTo);
  const rangeTooLong =
    Boolean(draftFrom && draftTo && draftFrom <= draftTo) &&
    Math.floor(
      (new Date(`${draftTo}T12:00:00`).getTime() - new Date(`${draftFrom}T12:00:00`).getTime()) /
        86400000
    ) +
      1 >
      365;
  const isTodayRange = bundle.dateFrom === bundle.today && bundle.dateTo === bundle.today;

  const triggerLabel = useMemo(
    () => formatManagerResultsPeriodLabel(bundle.dateFrom, bundle.dateTo, formatDate),
    [bundle.dateFrom, bundle.dateTo, formatDate]
  );

  const applyPreset = (preset: (typeof EXECUTIVE_REPORT_PRESETS)[number]["key"]) => {
    switch (preset) {
      case "week":
        bundle.onPeriodChange(startOfIsoWeek(bundle.today), bundle.today);
        break;
      case "prev-week": {
        const prevWeekEnd = addIsoDays(startOfIsoWeek(bundle.today), -1);
        bundle.onPeriodChange(addIsoDays(prevWeekEnd, -6), prevWeekEnd);
        break;
      }
      case "month":
        bundle.onPeriodChange(startOfIsoMonth(bundle.today), bundle.today);
        break;
      case "30d":
        bundle.onPeriodChange(addIsoDays(bundle.today, -29), bundle.today);
        break;
      default:
        break;
    }
    setMenuOpen(false);
  };

  const applyDraft = () => {
    if (!draftFrom || !draftTo || rangeInvalid || rangeTooLong) return;
    bundle.onPeriodChange(draftFrom, draftTo);
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      const root = menuRef.current;
      if (!root || root.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menuOpen]);

  return (
    <div className={styles.managerResultsPeriodNav} ref={menuRef}>
      <div className={styles.coveragePeriodPicker}>
        <button
          type="button"
          className={`${styles.coveragePeriodTrigger} ${menuOpen ? styles.coveragePeriodTriggerOpen : ""}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <CalendarDays size={14} strokeWidth={2.2} aria-hidden="true" />
          <span>{bundle.loading ? "Загружаем…" : triggerLabel}</span>
          <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
        </button>

        {menuOpen ? (
          <div
            className={styles.coveragePeriodMenu}
            role="menu"
            aria-label="Выбор периода результатов менеджеров"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.coveragePeriodMenuPresets} role="group" aria-label="Быстрый выбор периода">
              {EXECUTIVE_REPORT_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  role="menuitem"
                  className={styles.coveragePeriodBtn}
                  onClick={() => applyPreset(preset.key)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className={styles.coveragePeriodMenuRange}>
              <label className={styles.coveragePeriodMenuField}>
                <span>Дата начала</span>
                <input
                  type="date"
                  className={styles.coveragePeriodMenuDateInput}
                  value={draftFrom}
                  max={draftTo || bundle.today}
                  onChange={(event) => {
                    if (event.target.value) setDraftFrom(event.target.value);
                  }}
                  aria-label="Дата начала"
                />
              </label>
              <label className={styles.coveragePeriodMenuField}>
                <span>Дата окончания</span>
                <input
                  type="date"
                  className={styles.coveragePeriodMenuDateInput}
                  value={draftTo}
                  min={draftFrom}
                  max={bundle.today}
                  onChange={(event) => {
                    if (event.target.value) setDraftTo(event.target.value);
                  }}
                  aria-label="Дата окончания"
                />
              </label>
            </div>

            {rangeInvalid ? (
              <p className={styles.coveragePeriodMenuError}>Дата начала не может быть позже даты окончания.</p>
            ) : rangeTooLong ? (
              <p className={styles.coveragePeriodMenuError}>Максимальная длина периода — 365 дней.</p>
            ) : null}

            <div className={styles.managerResultsPeriodMenuActions}>
              <button
                type="button"
                className={styles.managerResultsPeriodApplyBtn}
                disabled={!draftFrom || !draftTo || rangeInvalid || rangeTooLong}
                onClick={applyDraft}
              >
                Применить
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {!isTodayRange ? (
        <button
          type="button"
          className={styles.managerResultsTodayBtn}
          onClick={() => bundle.onPeriodChange(bundle.today, bundle.today)}
        >
          Сегодня
        </button>
      ) : null}
      <button
        type="button"
        className={styles.managerResultsRefreshBtn}
        aria-label="Обновить данные"
        disabled={bundle.loading}
        onClick={() => bundle.onRefresh()}
      >
        <RefreshCw
          size={14}
          strokeWidth={2.4}
          className={bundle.loading ? styles.managerResultsSpin : ""}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

function ManagerResultsLoadingState() {
  return (
    <div className={styles.managerResultsLoadingGrid} aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className={styles.managerResultsSkeletonCard} />
      ))}
      <div className={styles.managerResultsSkeletonWide} />
    </div>
  );
}

function ManagerResultTaskList({
  tasks,
  formatDate,
  showShiftDate = false,
  onTaskOpen
}: {
  tasks: ManagerCompletionTask[];
  formatDate?: (iso: string | null | undefined) => string;
  showShiftDate?: boolean;
  onTaskOpen: (task: ManagerCompletionTask) => void;
}) {
  if (tasks.length === 0) {
    return <p className={styles.managerResultsEmpty}>Заданий в отчёте нет.</p>;
  }

  return (
    <div className={styles.managerResultTaskList}>
      {tasks.map((task) => {
        const title = taskValue(task, "nomenclature") || "Задание";
        const status = taskValue(task, "status");
        const tone = managerResultStatusTone(status);
        const resultText = taskValue(task, "result_text");
        const reason = taskValue(task, "reason");
        const deadline = taskValue(task, "deadline");
        const taskType = taskValue(task, "task_type");
        const shiftDate = taskValue(task, "shift_date");
        const taskKey = `${taskValue(task, "key")}-${title}-${taskType}-${shiftDate}`;
        return (
          <button
            key={taskKey}
            type="button"
            className={styles.managerResultTaskRow}
            aria-label={`Открыть задание: ${title}`}
            onClick={() => onTaskOpen(task)}
          >
            <div className={styles.managerResultTaskMain}>
              <div className={styles.managerResultTaskHead}>
                <strong>{title}</strong>
                <span
                  className={`${styles.managerResultStatusPill} ${managerResultStatusPillClass(tone)}`}
                >
                  {managerResultStatusLabel(status)}
                </span>
              </div>
              <p className={styles.managerResultTaskMeta}>
                {taskType || "тип не указан"}
                {showShiftDate && shiftDate && formatDate
                  ? ` · смена ${formatDate(shiftDate)}`
                  : ""}
                {deadline ? ` · ${formatManagerTaskDeadline(deadline)}` : ""}
                {taskValue(task, "deficit") ? ` · ${formatManagerTaskDeficit(task)}` : ""}
              </p>
              {resultText ? (
                <p className={styles.managerResultTaskResult}>{resultText}</p>
              ) : (
                <p className={styles.managerResultTaskPreviewHint}>Нажмите, чтобы открыть карточку задания</p>
              )}
              {reason && status !== "resolved" ? (
                <blockquote className={styles.managerResultTaskReason}>{reason}</blockquote>
              ) : null}
            </div>
            <ChevronRight
              size={16}
              strokeWidth={2.4}
              className={styles.managerResultTaskRowChevron}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}

function ManagerResultPanel({
  manager,
  isPeriodMode = false,
  formatDate
}: {
  manager: ManagerCompletionReport;
  isPeriodMode?: boolean;
  formatDate: (iso: string | null | undefined) => string;
}) {
  const [taskFilter, setTaskFilter] = useState<ManagerTaskTileFilter>("remaining");
  const [selectedTask, setSelectedTask] = useState<ManagerCompletionTask | null>(null);
  const isMissing = manager.reportStatus === "missing";
  const isInProgress = manager.reportStatus === "in_progress";
  const reportKind = isInProgress ? "live" : "submitted";
  const filteredTasks = useMemo(
    () => getFilteredManagerTasks(manager, taskFilter, reportKind),
    [manager, reportKind, taskFilter]
  );

  useEffect(() => {
    setTaskFilter("remaining");
    setSelectedTask(null);
  }, [manager.id, manager.reportStatus]);
  const sentAtLabel = manager.emailSentAt
    ? new Date(manager.emailSentAt).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
    : null;

  if (isMissing) {
    return (
      <article className={`${styles.managerResultPanel} ${styles.managerResultCardMissing}`}>
        <div className={styles.managerResultAnalytics}>
          <div className={styles.managerResultCardHead}>
            <div>
              <p className={styles.managerResultEyebrow}>Менеджер</p>
              <h3>{manager.managerName}</h3>
              {manager.regionLabel ? (
                <p className={styles.managerResultRegionLabel}>{manager.regionLabel}</p>
              ) : null}
              <span className={`${styles.managerResultStatusPill} ${styles.managerResultStatusPill_muted}`}>
                Смена не завершена
              </span>
            </div>
            <ManagerProgressRing stats={manager.stats} missing />
          </div>
          <p className={styles.managerResultMissingHint}>
            {isPeriodMode
              ? "За выбранный период менеджер не завершил ни одной смены — отчёты не поступили."
              : "За этот день менеджер не нажал «Завершить смену» — отчёт не поступил. Данные по заданиям недоступны."}
          </p>
        </div>
      </article>
    );
  }

  if (isInProgress) {
    return (
      <article className={`${styles.managerResultPanel} ${styles.managerResultCardLive}`}>
        <div className={styles.managerResultAnalytics}>
          <div className={styles.managerResultCardHead}>
            <div>
              <p className={styles.managerResultEyebrow}>Менеджер</p>
              <h3>{manager.managerName}</h3>
              {manager.regionLabel ? (
                <p className={styles.managerResultRegionLabel}>{manager.regionLabel}</p>
              ) : null}
            </div>
            <ManagerProgressRing stats={manager.stats} />
          </div>
          <ManagerResultTiles
            stats={manager.stats}
            filter={taskFilter}
            remainingLabel="Осталось"
            onFilterChange={setTaskFilter}
          />
        </div>

        <div className={styles.managerResultPanelScroll}>
          <section
            className={styles.managerResultTasksBlock}
            aria-label={`${managerTaskFilterTitle(taskFilter, "live")} ${manager.managerName}`}
          >
            <div className={styles.managerResultTasksBlockHead}>
              <h4>
                {managerTaskFilterTitle(taskFilter, "live")}
                <span className={styles.managerResultTasksCount}> · {filteredTasks.length}</span>
              </h4>
            </div>
            {filteredTasks.length > 0 ? (
              <ManagerResultTaskList
                tasks={filteredTasks}
                formatDate={formatDate}
                showShiftDate={isPeriodMode}
                onTaskOpen={setSelectedTask}
              />
            ) : (
              <p className={styles.managerResultsEmptyCompact}>
                {managerTaskFilterEmpty(taskFilter, "live")}
              </p>
            )}
          </section>
        </div>
        {selectedTask ? (
          <ManagerResultTaskModal
            task={selectedTask}
            manager={manager}
            formatDate={formatDate}
            onClose={() => setSelectedTask(null)}
          />
        ) : null}
      </article>
    );
  }

  return (
    <>
    <article className={styles.managerResultPanel}>
      <div className={styles.managerResultAnalytics}>
        <div className={styles.managerResultCardHead}>
          <div>
            <p className={styles.managerResultEyebrow}>Менеджер</p>
            <h3>{manager.managerName}</h3>
            {manager.regionLabel ? (
              <p className={styles.managerResultRegionLabel}>{manager.regionLabel}</p>
            ) : null}
            {isPeriodMode && manager.daysWithReports != null && manager.daysWithReports > 0 ? (
              <p className={styles.managerResultPeriodMeta}>
                Смен с отчётом: {manager.daysWithReports}
              </p>
            ) : null}
            {manager.emailSentTo ? (
              <p className={styles.managerResultsEmailMeta}>
                Отчёт отправлен{sentAtLabel ? ` · ${sentAtLabel}` : ""}
                {manager.emailSentTo ? ` · ${manager.emailSentTo}` : ""}
              </p>
            ) : null}
          </div>
          <ManagerProgressRing stats={manager.stats} />
        </div>
        <ManagerResultTiles
          stats={manager.stats}
          filter={taskFilter}
          remainingLabel="Не закрыто"
          onFilterChange={setTaskFilter}
        />
      </div>

      <div className={styles.managerResultPanelScroll}>
        <section
          className={styles.managerResultTasksBlock}
          aria-label={`${managerTaskFilterTitle(taskFilter, "submitted")} ${manager.managerName}`}
        >
          <div className={styles.managerResultTasksBlockHead}>
            <h4>
              {managerTaskFilterTitle(taskFilter, "submitted")}
              <span className={styles.managerResultTasksCount}> · {filteredTasks.length}</span>
            </h4>
          </div>
          {filteredTasks.length > 0 ? (
            <ManagerResultTaskList
              tasks={filteredTasks}
              formatDate={formatDate}
              showShiftDate={isPeriodMode}
              onTaskOpen={setSelectedTask}
            />
          ) : (
            <p className={styles.managerResultsEmptyCompact}>
              {managerTaskFilterEmpty(taskFilter, "submitted")}
            </p>
          )}
        </section>
      </div>
    </article>
    {selectedTask ? (
      <ManagerResultTaskModal
        task={selectedTask}
        manager={manager}
        formatDate={formatDate}
        onClose={() => setSelectedTask(null)}
      />
    ) : null}
    </>
  );
}

function ManagerResultsDashboard({
  bundle,
  formatDate
}: {
  bundle: ManagerResultsBundle;
  formatDate: (iso: string | null | undefined) => string;
}) {
  const dashboard = bundle.dashboard;
  const isSingleDay = bundle.dateFrom === bundle.dateTo;
  const isPeriodMode = !isSingleDay;
  const hasData = Boolean(dashboard && dashboard.managers.length > 0);
  const hasReportsInPeriod = bundle.availableDates.some(
    (entry) =>
      entry.reportDate >= bundle.dateFrom &&
      entry.reportDate <= bundle.dateTo &&
      (entry.reportsCount > 0 || entry.hasLive)
  );
  const roster = dashboard?.roster ?? { total: 2, submitted: 0, inProgress: 0, missing: 2 };
  const submittedShiftsLabel =
    isPeriodMode &&
    dashboard?.submittedShiftDays != null &&
    dashboard?.expectedShiftDays != null
      ? `${dashboard.submittedShiftDays}/${dashboard.expectedShiftDays}`
      : `${roster.submitted}/${roster.total}`;
  const submittedShiftsCaption = isPeriodMode ? "Смен сдано" : "Отчётов сдано";
  const summaryGrid =
    dashboard && !bundle.loading && !bundle.error && hasData ? (
      <div className={styles.managerResultsSummaryGrid}>
        <article className={styles.managerResultsSummaryCard}>
          <span>{submittedShiftsCaption}</span>
          <strong>{submittedShiftsLabel}</strong>
        </article>
        {isPeriodMode && dashboard.daysInPeriod ? (
          <article className={styles.managerResultsSummaryCard}>
            <span>Дней в периоде</span>
            <strong>{dashboard.daysInPeriod}</strong>
          </article>
        ) : null}
        {roster.inProgress > 0 ? (
          <article className={`${styles.managerResultsSummaryCard} ${styles.managerResultsSummaryCardLive}`}>
            <span>В live-режиме</span>
            <strong>{roster.inProgress}</strong>
          </article>
        ) : null}
        <article className={styles.managerResultsSummaryCard}>
          <span>Всего заданий</span>
          <strong>{dashboard.summary.total}</strong>
        </article>
        <article className={styles.managerResultsSummaryCard}>
          <span>Выполнено</span>
          <strong className={styles.managerResultsSuccess}>{dashboard.summary.resolved}</strong>
        </article>
        <article className={styles.managerResultsSummaryCard}>
          <span>Не выполнено</span>
          <strong className={styles.managerResultsDanger}>{dashboard.summary.incomplete}</strong>
        </article>
      </div>
    ) : null;

  return (
    <section className={styles.managerResultsBoard} aria-label="Результаты работы менеджеров">
      <div className={styles.managerResultsScrollHost}>
        <div className={styles.managerResultsTopContent}>
        <ExecutiveReportBar bundle={bundle} formatDate={formatDate} />
        {bundle.executiveReportError ? (
          <p className={styles.managerResultsReportError}>{bundle.executiveReportError}</p>
        ) : null}
        {bundle.loading ? (
        <ManagerResultsLoadingState />
      ) : bundle.error ? (
        <div className={styles.managerResultsErrorBox}>
          <p>{bundle.error}</p>
          <button type="button" className={styles.managerResultsRetryBtn} onClick={() => bundle.onRetry()}>
            Повторить
          </button>
        </div>
      ) : !hasData ? (
        <div className={styles.managerResultsEmptyState}>
          <p className={styles.managerResultsEmpty}>
            {hasReportsInPeriod
              ? "Отчёты за выбранный период ещё обрабатываются или данные недоступны."
              : isSingleDay && bundle.dateFrom === bundle.today
                ? "Сменное задание ещё не сформировано — выполните анализ Excel, чтобы менеджеры получили задания."
                : isPeriodMode
                  ? "За выбранный период менеджеры ещё не завершали смены."
                  : "За выбранный день менеджеры ещё не завершали смену."}
          </p>
          {bundle.availableDates.length > 0 ? (
            <p className={styles.managerResultsEmptyHint}>
              Выберите другой период в панели выше — доступно {bundle.availableDates.length}{" "}
              {bundle.availableDates.length === 1 ? "день" : bundle.availableDates.length < 5 ? "дня" : "дней"} с отчётами.
            </p>
          ) : null}
        </div>
      ) : dashboard ? (
          <>
            {roster.missing > 0 && roster.inProgress === 0 ? (
              <p className={styles.managerResultsRosterHint}>
                {isPeriodMode
                  ? roster.missing === roster.total
                    ? "За выбранный период ни один менеджер не завершил смену."
                    : `${roster.missing} смен(ы) без отчёта — карточки отмечены как «Смена не завершена».`
                  : roster.missing === roster.total
                    ? "За этот день ни один менеджер не завершил смену."
                    : `${roster.missing} из ${roster.total} менеджеров не сдали отчёт — карточки отмечены как «Смена не завершена».`}
              </p>
            ) : null}
            {roster.missing > 0 && roster.inProgress > 0 ? (
              <p className={styles.managerResultsRosterHint}>
                {roster.missing} менеджер(ов) ещё не получили сменное задание или не начали работу.
              </p>
            ) : null}
          </>
        ) : null}
        </div>

        {summaryGrid ? <div className={styles.managerResultsSummarySticky}>{summaryGrid}</div> : null}

        {dashboard && !bundle.loading && !bundle.error && hasData ? (
          <div className={styles.managerResultsManagerStage}>
            <div className={styles.managerResultsManagerStack}>
              {dashboard.managers.map((manager) => (
                <ManagerResultPanel
                  key={manager.id}
                  manager={manager}
                  isPeriodMode={isPeriodMode}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

type CoveragePeriodSelectionMode = "preset" | "range";

function CoveragePeriodPicker({
  period,
  periodMode,
  rangeFrom,
  rangeTo,
  menuOpen,
  rangeLoading,
  rangeError,
  onToggleMenu,
  onCloseMenu,
  onPresetSelect,
  onRangeFromChange,
  onRangeToChange,
  formatDate
}: {
  period: CoveragePeriodKey;
  periodMode: CoveragePeriodSelectionMode;
  rangeFrom: string;
  rangeTo: string;
  menuOpen: boolean;
  rangeLoading: boolean;
  rangeError: string | null;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onPresetSelect: (nextPeriod: CoveragePeriodKey) => void;
  onRangeFromChange: (value: string) => void;
  onRangeToChange: (value: string) => void;
  formatDate: (iso: string | null | undefined) => string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  const triggerLabel = useMemo(() => {
    if (periodMode === "range" && rangeFrom && rangeTo) {
      return `${formatDate(rangeFrom)}–${formatDate(rangeTo)}`;
    }
    if (periodMode === "preset") {
      return PERIOD_OPTIONS.find((option) => option.key === period)?.label ?? "Выбрать период";
    }
    return "Выбрать период";
  }, [formatDate, period, periodMode, rangeFrom, rangeTo]);

  const rangeInvalid = Boolean(rangeFrom && rangeTo && rangeFrom > rangeTo);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseMenu();
    };
    const onPointerDown = (event: MouseEvent) => {
      const root = menuRef.current;
      if (!root || root.contains(event.target as Node)) return;
      onCloseMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menuOpen, onCloseMenu]);

  return (
    <div className={styles.coveragePeriodPicker} ref={menuRef}>
      <button
        type="button"
        className={`${styles.coveragePeriodTrigger} ${menuOpen ? styles.coveragePeriodTriggerOpen : ""}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={onToggleMenu}
      >
        <CalendarDays size={14} strokeWidth={2.2} aria-hidden="true" />
        <span>{rangeLoading ? "Считаем…" : triggerLabel}</span>
        <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
      </button>

      {menuOpen ? (
        <div
          className={styles.coveragePeriodMenu}
          role="menu"
          aria-label="Выбор периода обеспеченности"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className={styles.coveragePeriodMenuPresets} role="group" aria-label="Рекомендованные периоды">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                role="menuitemradio"
                aria-checked={periodMode === "preset" && period === option.key}
                className={`${styles.coveragePeriodBtn} ${
                  periodMode === "preset" && period === option.key ? styles.coveragePeriodBtnActive : ""
                }`}
                onClick={() => onPresetSelect(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className={styles.coveragePeriodMenuRange}>
            <label className={styles.coveragePeriodMenuField}>
              <span>Дата начала</span>
              <input
                type="date"
                className={styles.coveragePeriodMenuDateInput}
                value={rangeFrom}
                onChange={(event) => {
                  if (event.target.value) onRangeFromChange(event.target.value);
                }}
                aria-label="Дата начала"
              />
            </label>
            <label className={styles.coveragePeriodMenuField}>
              <span>Дата окончания</span>
              <input
                type="date"
                className={styles.coveragePeriodMenuDateInput}
                value={rangeTo}
                onChange={(event) => {
                  if (event.target.value) onRangeToChange(event.target.value);
                }}
                aria-label="Дата окончания"
              />
            </label>
          </div>

          {rangeLoading ? (
            <p className={styles.coveragePeriodMenuStatus}>Пересчёт дашборда…</p>
          ) : null}

          {rangeInvalid ? (
            <p className={styles.coveragePeriodMenuError}>Дата начала не может быть позже даты окончания.</p>
          ) : rangeError ? (
            <p className={styles.coveragePeriodMenuError}>{rangeError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type CoverageDashboardTilesProps = {
  dashboard: CoverageDashboardPayload;
  formatDate?: (iso: string | null | undefined) => string;
  onFetchCustomPeriod?: (dateFrom: string, dateTo: string) => Promise<CoveragePeriodPayload | null>;
  stockBalances?: StockBalancesCache | null;
  managerTasks?: ShiftTaskBoardProps | null;
  managerTasksNotice?: ManagerTasksNotice | null;
  managerResults?: ManagerResultsBundle | null;
};

export function CoverageDashboardTiles({
  dashboard,
  formatDate = formatRuDate,
  onFetchCustomPeriod,
  stockBalances = null,
  managerTasks = null,
  managerTasksNotice = null,
  managerResults = null
}: CoverageDashboardTilesProps) {
  const stockByName = useMemo(
    () => buildStockWarehousesByName(stockBalances?.items ?? []),
    [stockBalances]
  );
  const hasManagerResultsSide = Boolean(managerResults);
  const hasTasksSide =
    !hasManagerResultsSide && (Boolean(managerTasks) || Boolean(managerTasksNotice));
  const hasExtraSide = hasTasksSide || hasManagerResultsSide;
  const [period, setPeriod] = useState<CoveragePeriodKey>(dashboard.defaultPeriod ?? "day");
  const [periodMode, setPeriodMode] = useState<CoveragePeriodSelectionMode>("preset");
  const [customPeriodData, setCustomPeriodData] = useState<CoveragePeriodPayload | null>(null);
  const scheduleBounds = useMemo(() => resolveCoverageScheduleBounds(dashboard), [dashboard]);
  const [rangeFrom, setRangeFrom] = useState(
    () =>
      rangeFromPeriodDays(dashboard.periods[dashboard.defaultPeriod ?? "day"]?.days)?.from ??
      scheduleBounds.min
  );
  const [rangeTo, setRangeTo] = useState(
    () =>
      rangeFromPeriodDays(dashboard.periods[dashboard.defaultPeriod ?? "day"]?.days)?.to ??
      scheduleBounds.max
  );
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [selectedTile, setSelectedTile] = useState<CoverageTileKey>("all");
  const [dashboardSide, setDashboardSide] = useState<CoverageDashboardSide>("products");
  const [explainedTileBySide, setExplainedTileBySide] = useState(createEmptyExplainedTiles);
  const [viewTransition, setViewTransition] = useState<CoverageViewTransition | null>(null);
  const [sectionAnimKey, setSectionAnimKey] = useState(0);
  const [coverageFlipAnimating, setCoverageFlipAnimating] = useState(false);
  const [coverageFlipVisual, setCoverageFlipVisual] = useState<"products" | "nomenclatures">("products");
  const transitionTimerRef = useRef<number | null>(null);
  const coverageFlipTimerRef = useRef<number | null>(null);
  const carouselPanelRefs = useRef<{
    coverage: HTMLDivElement | null;
    tasks: HTMLDivElement | null;
    manager_results: HTMLDivElement | null;
  }>({
    coverage: null,
    tasks: null,
    manager_results: null
  });
  const [carouselViewportHeight, setCarouselViewportHeight] = useState<number | undefined>();

  const scheduleViewTransition = useCallback(
    (transition: CoverageViewTransition, durationMs: number) => {
      setViewTransition(transition);
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      transitionTimerRef.current = window.setTimeout(() => {
        setViewTransition(null);
        transitionTimerRef.current = null;
      }, durationMs);
    },
    []
  );

  useEffect(
    () => () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      if (coverageFlipTimerRef.current !== null) {
        window.clearTimeout(coverageFlipTimerRef.current);
      }
    },
    []
  );

  const beginCoverageFlipAnimation = useCallback((nextVisual: "products" | "nomenclatures") => {
    setCoverageFlipAnimating(true);
    if (coverageFlipTimerRef.current !== null) {
      window.clearTimeout(coverageFlipTimerRef.current);
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setCoverageFlipVisual(nextVisual);
      });
    });
    coverageFlipTimerRef.current = window.setTimeout(() => {
      setCoverageFlipAnimating(false);
      coverageFlipTimerRef.current = null;
    }, COVERAGE_FLIP_TRANSITION_MS);
  }, []);

  useEffect(() => {
    const nextPeriod = dashboard.defaultPeriod ?? "day";
    const nextRange =
      rangeFromPeriodDays(dashboard.periods[nextPeriod]?.days) ??
      rangeFromPeriodDays(dashboard.periods.day?.days) ??
      rangeFromPeriodDays(dashboard.periods.week?.days) ??
      rangeFromPeriodDays(dashboard.periods.month?.days);
    setPeriod(nextPeriod);
    setPeriodMode("preset");
    setCustomPeriodData(null);
    if (nextRange) {
      setRangeFrom(nextRange.from);
      setRangeTo(nextRange.to);
    }
    setPeriodMenuOpen(false);
    setRangeLoading(false);
    setRangeError(null);
    setSelectedTile("all");
    setDashboardSide("products");
    setExplainedTileBySide(createEmptyExplainedTiles());
    setViewTransition(null);
    setSectionAnimKey(0);
    setCoverageFlipVisual("products");
    setCoverageFlipAnimating(false);
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (coverageFlipTimerRef.current !== null) {
      window.clearTimeout(coverageFlipTimerRef.current);
      coverageFlipTimerRef.current = null;
    }
  }, [dashboard.asOf, dashboard.defaultPeriod, dashboard.scheduleMonth, scheduleBounds]);

  useEffect(() => {
    setExplainedTileBySide(createEmptyExplainedTiles());
  }, [period, dashboardSide]);

  useEffect(() => {
    if (dashboardSide === "tasks" && !hasTasksSide) {
      setDashboardSide("products");
    }
    if (dashboardSide === "manager_results" && !hasManagerResultsSide) {
      setDashboardSide("products");
    }
  }, [dashboardSide, hasManagerResultsSide, hasTasksSide]);

  const isProductsMode = dashboardSide === "products";
  const isNomenclaturesMode = dashboardSide === "nomenclatures";
  const isTasksMode = dashboardSide === "tasks";
  const isManagerResultsMode = dashboardSide === "manager_results";
  const isCoverageMode = isProductsMode || isNomenclaturesMode;

  useEffect(() => {
    if (!hasExtraSide || !isCoverageMode) {
      setCarouselViewportHeight(undefined);
      return undefined;
    }

    const panel = carouselPanelRefs.current.coverage;
    if (!panel) return undefined;

    const updateHeight = () => {
      setCarouselViewportHeight(panel.offsetHeight);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [hasExtraSide, isCoverageMode, period, selectedTile, managerTasks, managerResults]);

  useEffect(() => {
    const hasOpen = Boolean(explainedTileBySide.products || explainedTileBySide.nomenclatures);
    if (!hasOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExplainedTileBySide(createEmptyExplainedTiles());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [explainedTileBySide]);

  const rawPeriodData =
    periodMode === "range" && customPeriodData
      ? customPeriodData
      : dashboard.periods[period] ?? dashboard.periods.day ?? dashboard.periods.week ?? dashboard.periods.month;
  const periodData = rawPeriodData;

  const tileValues = useMemo(() => {
    if (!periodData) {
      return {
        products: { all: 0, green: 0, yellow: 0, red: 0 },
        nomenclatures: { all: 0, green: 0, yellow: 0, red: 0 }
      };
    }
    return {
      products: periodData.products.tiles,
      nomenclatures: periodData.nomenclatures.tiles
    };
  }, [periodData]);

  const selectedTileMeta = COVERAGE_TILES.find((tile) => tile.key === selectedTile) ?? COVERAGE_TILES[0];

  const handleTileClick = useCallback((tileKey: CoverageTileKey) => {
    setSelectedTile(tileKey);
  }, []);

  const toggleTileExplanation = useCallback((side: CoverageSideKey, tileKey: CoverageTileKey) => {
    setExplainedTileBySide((current) => ({
      ...current,
      [side]: current[side] === tileKey ? null : tileKey
    }));
  }, []);

  const handleTileContextMenu = useCallback(
    (event: ReactMouseEvent, side: CoverageSideKey, tileKey: CoverageTileKey) => {
      event.preventDefault();
      event.stopPropagation();
      toggleTileExplanation(side, tileKey);
    },
    [toggleTileExplanation]
  );

  const closeTileExplanation = useCallback((side: CoverageSideKey) => {
    setExplainedTileBySide((current) => ({
      ...current,
      [side]: null
    }));
  }, []);

  const applyDateRange = useCallback(
    async (dateFrom: string, dateTo: string) => {
      if (!dateFrom || !dateTo || dateFrom > dateTo) return;
      const matchedPreset = matchingPresetPeriod(dashboard, dateFrom, dateTo);
      if (matchedPreset) {
        if (periodMode !== "preset" || period !== matchedPreset) {
          scheduleViewTransition({ kind: "period" }, COVERAGE_PERIOD_TRANSITION_MS);
        }
        setPeriodMode("preset");
        setCustomPeriodData(null);
        setRangeError(null);
        setPeriod(matchedPreset);
        return;
      }
      if (!onFetchCustomPeriod) {
        setRangeError("Пересчёт произвольного периода недоступен.");
        return;
      }
      setRangeLoading(true);
      setRangeError(null);
      try {
        const nextPeriod = await onFetchCustomPeriod(dateFrom, dateTo);
        if (!nextPeriod) {
          setRangeError("В выбранном диапазоне нет рабочих дней графика.");
          return;
        }
        scheduleViewTransition({ kind: "period" }, COVERAGE_PERIOD_TRANSITION_MS);
        setPeriodMode("range");
        setCustomPeriodData(nextPeriod);
      } catch (error) {
        setRangeError(error instanceof Error ? error.message : "Не удалось пересчитать период.");
      } finally {
        setRangeLoading(false);
      }
    },
    [dashboard, onFetchCustomPeriod, period, periodMode, scheduleViewTransition]
  );

  const handlePeriodChange = useCallback(
    (nextPeriod: CoveragePeriodKey) => {
      const nextRange = rangeFromPeriodDays(dashboard.periods[nextPeriod]?.days);
      if (nextRange) {
        setRangeFrom(nextRange.from);
        setRangeTo(nextRange.to);
      }
      if (nextPeriod !== period || periodMode !== "preset") {
        scheduleViewTransition({ kind: "period" }, COVERAGE_PERIOD_TRANSITION_MS);
      }
      setPeriodMode("preset");
      setCustomPeriodData(null);
      setRangeError(null);
      setPeriod(nextPeriod);
    },
    [dashboard.periods, period, periodMode, scheduleViewTransition]
  );

  useEffect(() => {
    if (!rangeFrom || !rangeTo || rangeFrom > rangeTo) return;
    const matchedPreset = matchingPresetPeriod(dashboard, rangeFrom, rangeTo);
    if (matchedPreset && periodMode === "preset" && period === matchedPreset) return;
    const timer = window.setTimeout(() => {
      void applyDateRange(rangeFrom, rangeTo);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [applyDateRange, dashboard, period, periodMode, rangeFrom, rangeTo]);

  const selectDashboardSide = useCallback(
    (nextSide: CoverageDashboardSide) => {
      if (nextSide === "tasks" && !hasTasksSide) return;
      if (nextSide === "manager_results" && !hasManagerResultsSide) return;
      if (nextSide === dashboardSide) return;
      if (isCoverageFlipTransition(dashboardSide, nextSide)) {
        beginCoverageFlipAnimation(nextSide === "nomenclatures" ? "nomenclatures" : "products");
        setDashboardSide(nextSide);
        setExplainedTileBySide(createEmptyExplainedTiles());
        return;
      }
      if (nextSide === "products" || nextSide === "nomenclatures") {
        setCoverageFlipVisual(nextSide);
      }
      setSectionAnimKey((current) => current + 1);
      scheduleViewTransition({ kind: "section" }, COVERAGE_SECTION_TRANSITION_MS);
      setDashboardSide(nextSide);
      setExplainedTileBySide(createEmptyExplainedTiles());
    },
    [beginCoverageFlipAnimation, dashboardSide, hasManagerResultsSide, hasTasksSide, scheduleViewTransition]
  );

  const sectionPanelAnimClass = useCallback(
    (panel: "coverage" | "tasks" | "manager_results") => {
      if (viewTransition?.kind !== "section") return "";
      if (panel === "coverage" && isCoverageMode) return styles.coverageAnimSection;
      if (panel === "tasks" && isTasksMode) return styles.coverageAnimSection;
      if (panel === "manager_results" && isManagerResultsMode) return styles.coverageAnimSection;
      return "";
    },
    [viewTransition, isCoverageMode, isTasksMode, isManagerResultsMode]
  );

  const periodAnimClassForSide = useCallback(
    (side: "products" | "nomenclatures") =>
      viewTransition?.kind === "period" && dashboardSide === side
        ? coverageTransitionClass(viewTransition)
        : "",
    [dashboardSide, viewTransition]
  );
  const animatingView = viewTransition !== null;
  const coveragePeriodLabel =
    !isTasksMode && !isManagerResultsMode && periodData?.days?.length
      ? formatCoveragePeriodLabel(periodData.days, formatDate)
      : null;

  if (!periodData) return null;

  const renderSidePanel = (side: CoverageSideKey) => {
    const showNomSide = side === "nomenclatures";
    const sideTilesLocal = showNomSide ? tileValues.nomenclatures : tileValues.products;
    const explainedTile = explainedTileBySide[side];
    const detailRowsLocal = filterRows(
      showNomSide ? periodData.nomenclatures.rows : periodData.products.rows,
      selectedTileMeta.key
    );
    return (
      <>
        <div className={`${styles.riskAnalyticsBlock} ${styles.coverageSummaryBlock}`}>
          <div className={styles.riskAnalyticsRow}>
            <div className={styles.coverageAnalyticsTiles} role="group" aria-label="Обеспеченность">
              {COVERAGE_TILES.map((tile) => {
                const isSelected = selectedTile === tile.key;
                const isFlipped = explainedTile === tile.key;
                const Icon = tileIcon(tile.key);
                const metric = tileMetricValue(tile.key, sideTilesLocal, side);
                const displayLabel = coverageTileLabel(tile.key, side);

                return (
                  <div
                    key={tile.key}
                    className={styles.riskTileFlipScene}
                    onContextMenu={(event) => handleTileContextMenu(event, side, tile.key)}
                  >
                    <div
                      className={`${styles.riskTileFlipCard} ${
                        isFlipped ? styles.riskTileFlipCardFlipped : ""
                      }`}
                    >
                      <div
                        className={`${styles.riskAnalyticsTile} ${styles.riskTileFace} ${styles.riskTileFaceFront} ${coverageTileSurfaceClass(tile.key)} ${styles.coverageTileFront} ${
                          isSelected ? styles.riskAnalyticsTileActive : ""
                        }`}
                      >
                        <button
                          type="button"
                          className={styles.coverageTileMainBtn}
                          aria-pressed={isSelected}
                          aria-expanded={isFlipped}
                          aria-label={`${displayLabel}: ${metric.value}. Выбрать для таблицы`}
                          onClick={() => handleTileClick(tile.key)}
                        >
                          <span
                            className={`${styles.riskAnalyticsTileIcon} ${coverageTileIconClass(tile.key)}`}
                            aria-hidden="true"
                          >
                            <Icon size={22} strokeWidth={2} />
                          </span>
                          <span className={styles.riskAnalyticsTileBody}>
                            <span className={styles.riskAnalyticsTileLabel}>{displayLabel}</span>
                            <strong className={styles.riskAnalyticsTileValue}>{metric.value}</strong>
                            <span className={styles.coverageTileSubLabel}>{metric.subLabel}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.coverageTileInfoBtn} ${
                            isFlipped ? styles.coverageTileInfoBtnActive : ""
                          }`}
                          aria-label={`Подробнее: ${displayLabel}`}
                          aria-expanded={isFlipped}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleTileExplanation(side, tile.key);
                          }}
                          onContextMenu={(event) => handleTileContextMenu(event, side, tile.key)}
                        >
                          <CircleHelp size={15} strokeWidth={2.2} aria-hidden="true" />
                        </button>
                      </div>

                      <CoverageTileBackFace
                        tile={tile}
                        side={side}
                        onClose={() => closeTileExplanation(side)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <CoverageDetailTable
          tile={selectedTileMeta}
          side={side}
          rows={detailRowsLocal}
          periodLabel={periodData.label}
          stockByName={stockByName}
          animateIn={viewTransition?.kind === "period" && dashboardSide === side}
        />
      </>
    );
  };

  const coverageFlipPanel = (
    <div
      className={`${styles.riskTileFlipScene} ${styles.coverageSideFlipScene} ${
        coverageFlipAnimating ? styles.coverageSideFlipSceneAnimating : ""
      }`}
    >
      <div
        className={`${styles.riskTileFlipCard} ${styles.coverageSideFlipCard} ${
          coverageFlipVisual === "nomenclatures" ? styles.riskTileFlipCardFlipped : ""
        }`}
      >
        <div
          className={`${styles.riskTileFace} ${styles.riskTileFaceFront} ${styles.coverageSideFlipFace}`}
        >
          <div key={`products-${period}`} className={periodAnimClassForSide("products")}>
            {renderSidePanel("products")}
          </div>
        </div>
        <div
          className={`${styles.riskTileFace} ${styles.riskTileFaceBack} ${styles.coverageSideFlipFace}`}
        >
          <div key={`nomenclatures-${period}`} className={periodAnimClassForSide("nomenclatures")}>
            {renderSidePanel("nomenclatures")}
          </div>
        </div>
      </div>
    </div>
  );

  const dashboardModeSwitch = (
    <div className={styles.coverageTabStrip} role="tablist" aria-label="Тип дашборда">
      <button
        type="button"
        role="tab"
        aria-selected={isProductsMode}
        className={`${styles.coverageTab} ${isProductsMode ? styles.coverageTabActive : ""}`}
        onClick={() => selectDashboardSide("products")}
      >
        <Package size={14} strokeWidth={2.2} aria-hidden="true" />
        <span>Изделия</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isNomenclaturesMode}
        className={`${styles.coverageTab} ${isNomenclaturesMode ? styles.coverageTabActive : ""}`}
        onClick={() => selectDashboardSide("nomenclatures")}
      >
        <Layers size={14} strokeWidth={2.2} aria-hidden="true" />
        <span>Номенклатуры</span>
      </button>
      {hasTasksSide ? (
        <button
          type="button"
          role="tab"
          aria-selected={isTasksMode}
          className={`${styles.coverageTab} ${isTasksMode ? styles.coverageTabActive : ""}`}
          onClick={() => selectDashboardSide("tasks")}
        >
          <ClipboardList size={14} strokeWidth={2.2} aria-hidden="true" />
          <span>Задания</span>
        </button>
      ) : null}
      {hasManagerResultsSide ? (
        <button
          type="button"
          role="tab"
          aria-selected={isManagerResultsMode}
          className={`${styles.coverageTab} ${isManagerResultsMode ? styles.coverageTabActive : ""}`}
          onClick={() => selectDashboardSide("manager_results")}
        >
          <ClipboardList size={14} strokeWidth={2.2} aria-hidden="true" />
          <span>Результаты</span>
        </button>
      ) : null}
    </div>
  );

  const periodNav = (
    <div className={styles.coverageToolbar} role="toolbar" aria-label="Управление дашбордом обеспеченности">
      <CoveragePeriodPicker
        period={period}
        periodMode={periodMode}
        rangeFrom={rangeFrom}
        rangeTo={rangeTo}
        menuOpen={periodMenuOpen}
        rangeLoading={rangeLoading}
        rangeError={rangeError}
        onToggleMenu={() => setPeriodMenuOpen((current) => !current)}
        onCloseMenu={() => setPeriodMenuOpen(false)}
        onPresetSelect={handlePeriodChange}
        onRangeFromChange={setRangeFrom}
        onRangeToChange={setRangeTo}
        formatDate={formatDate}
      />
    </div>
  );

  const managerResultsToolbar = managerResults ? (
    <div
      className={`${styles.coverageToolbar} ${styles.coverageToolbarManagerResults}`}
      role="toolbar"
      aria-label="Аналитика менеджеров"
    >
      <ManagerResultsPeriodPicker bundle={managerResults} formatDate={formatDate} />
      <span className={styles.coverageToolbarDivider} aria-hidden="true" />
      {dashboardModeSwitch}
    </div>
  ) : null;

  return (
    <div
      className={`${styles.coverageEmbeddedBlock} ${
        isManagerResultsMode ? styles.coverageEmbeddedBlockManagerResults : ""
      } ${isTasksMode ? styles.coverageEmbeddedBlockTasks : ""}`}
    >
      {dashboardModeSwitch}

      <div className={styles.coverageTabPanel}>
        <div className={styles.coverageBoardHeader}>
          <h2 className={styles.coverageBoardTitle}>
            {isProductsMode
              ? "Обеспеченность по изделиям"
              : isNomenclaturesMode
                ? "Обеспеченность по номенклатурам"
                : isManagerResultsMode
                  ? "Результаты работы менеджеров"
                  : "Задачи сменного задания"}
            {coveragePeriodLabel ? ` · ${coveragePeriodLabel}` : ""}
          </h2>
          {!isTasksMode ? (
            <div className={styles.coverageDashboardControls}>
              {isManagerResultsMode ? managerResultsToolbar : periodNav}
            </div>
          ) : null}
        </div>

        <div
          className={styles.coverageAnimatedViewport}
          aria-busy={animatingView}
          aria-live="polite"
        >
        {hasExtraSide ? (
          <div
            className={`${styles.coverageSideCarouselViewport} ${
              isManagerResultsMode ? styles.coverageSideCarouselViewportManagerResults : ""
            } ${isTasksMode ? styles.coverageSideCarouselViewportTasks : ""}`}
            style={
              carouselViewportHeight && isCoverageMode
                ? { height: carouselViewportHeight }
                : undefined
            }
          >
            <div
              ref={(node) => {
                carouselPanelRefs.current.coverage = node;
              }}
              className={`${styles.coverageSideCarouselPanel} ${
                isCoverageMode ? "" : styles.coverageSideCarouselPanelHidden
              }`}
            >
              <div
                key={sectionPanelContentKey("coverage", isCoverageMode, sectionAnimKey)}
                className={sectionPanelAnimClass("coverage")}
              >
                {coverageFlipPanel}
              </div>
            </div>
            {hasTasksSide ? (
              <div
                ref={(node) => {
                  carouselPanelRefs.current.tasks = node;
                }}
                className={`${styles.coverageSideCarouselPanel} ${
                  isTasksMode ? "" : styles.coverageSideCarouselPanelHidden
                }`}
              >
                <div
                  key={sectionPanelContentKey("tasks", isTasksMode, sectionAnimKey)}
                  className={`${styles.coverageTasksPanelRoot} ${sectionPanelAnimClass("tasks")}`.trim()}
                >
                  {managerTasks ? (
                    <ShiftTaskBoard embedded {...managerTasks} />
                  ) : managerTasksNotice ? (
                    <ShiftTasksNewDayNotice
                      embedded
                      previousValidDate={managerTasksNotice.previousValidDate}
                      today={managerTasksNotice.today}
                      formatDate={formatDate}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
            {hasManagerResultsSide ? (
              <div
                ref={(node) => {
                  carouselPanelRefs.current.manager_results = node;
                }}
                className={`${styles.coverageSideCarouselPanel} ${
                  isManagerResultsMode ? "" : styles.coverageSideCarouselPanelHidden
                }`}
              >
                <div
                  key={sectionPanelContentKey("manager_results", isManagerResultsMode, sectionAnimKey)}
                  className={`${styles.managerResultsPanelRoot} ${sectionPanelAnimClass("manager_results")}`.trim()}
                >
                  {managerResults ? (
                    <ManagerResultsDashboard bundle={managerResults} formatDate={formatDate} />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          coverageFlipPanel
        )}
      </div>
      </div>
    </div>
  );
}

type CoverageDashboardProps = {
  dashboard: CoverageDashboardPayload | null;
  formatDate?: (iso: string | null | undefined) => string;
  onFetchCustomPeriod?: (dateFrom: string, dateTo: string) => Promise<CoveragePeriodPayload | null>;
  stockBalances?: StockBalancesCache | null;
  managerTasks?: ShiftTaskBoardProps | null;
  managerTasksNotice?: ManagerTasksNotice | null;
  managerResults?: ManagerResultsBundle | null;
};

export function CoverageDashboard({
  dashboard,
  formatDate = formatRuDate,
  onFetchCustomPeriod,
  stockBalances = null,
  managerTasks = null,
  managerTasksNotice = null,
  managerResults = null
}: CoverageDashboardProps) {
  if (!dashboard) return null;

  return (
    <section className={styles.coverageBoard} aria-label="Обеспеченность по изделиям">
      <CoverageDashboardTiles
        dashboard={dashboard}
        formatDate={formatDate}
        onFetchCustomPeriod={onFetchCustomPeriod}
        stockBalances={stockBalances}
        managerTasks={managerTasks}
        managerTasksNotice={managerTasksNotice}
        managerResults={managerResults}
      />
    </section>
  );
}

export { mapCoverageDashboard };
