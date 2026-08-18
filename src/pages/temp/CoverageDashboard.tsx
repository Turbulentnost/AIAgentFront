import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent
} from "react";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, CalendarDays, Layers, Package, RefreshCw, ShieldCheck, Siren, X } from "lucide-react";
import styles from "../DocumentAnalysisAgent.module.css";
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
  selectedDate: string;
  availableDates: ManagerCompletionDateEntry[];
  today: string;
  loading: boolean;
  error: string | null;
  executiveReportLoading?: boolean;
  executiveReportError?: string | null;
  onDateChange: (date: string) => void;
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

function toneClass(tone: CoverageTileMeta["tone"]): string {
  switch (tone) {
    case "success":
      return styles.riskAnalyticsTileSuccess;
    case "danger":
      return styles.riskAnalyticsTileDanger;
    case "critical":
      return styles.riskAnalyticsTileCritical;
    default:
      return "";
  }
}

function iconToneClass(tone: CoverageTileMeta["tone"]): string {
  switch (tone) {
    case "success":
      return styles.riskAnalyticsTileIconSuccess;
    case "danger":
      return styles.riskAnalyticsTileIconDanger;
    case "critical":
      return styles.riskAnalyticsTileIconCritical;
    default:
      return "";
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

function materialKindClass(kind: string | undefined): string {
  if (kind === "consumable") return styles.coverageMaterialConsumable;
  if (kind === "workshop") return styles.coverageMaterialWorkshop;
  return "";
}

function materialKindLabel(row: Pick<CoverageRow, "materialKind" | "materialKindLabel">): string {
  if (row.materialKindLabel) return row.materialKindLabel;
  if (row.materialKind === "consumable") return "возможно расходник";
  if (row.materialKind === "workshop") return "возможно в цехе";
  return "";
}

export function parseCoverageDashboard(raw: unknown): CoverageDashboardPayload | null {
  return mapCoverageDashboard(raw);
}

type CoverageDetailTableProps = {
  tile: CoverageTileMeta;
  side: "products" | "nomenclatures";
  rows: CoverageRow[];
  periodLabel: string;
  animateIn?: boolean;
};

type CoverageProblemMaterial = CoverageMaterialShortage & {
  products: string[];
};

function CoverageDetailTable({ tile, side, rows, periodLabel, animateIn = false }: CoverageDetailTableProps) {
  const sideLabel = side === "products" ? "изделия" : "номенклатуры";
  const tileLabel = coverageTileLabel(tile.key, side);
  const explanation = tileExplanation(tile, side);
  const showAvailable = side === "nomenclatures";
  const expandableProducts =
    side === "products" && (tile.key === "red" || tile.key === "yellow");
  const optionalRows = rows.filter((row) => row.optional);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [problemMenuOpen, setProblemMenuOpen] = useState(false);
  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [selectedProblemProducts, setSelectedProblemProducts] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    setExpandedProduct(null);
    setProblemMenuOpen(false);
    setProblemModalOpen(false);
  }, [tile.key, side, periodLabel]);

  useEffect(() => {
    if (side !== "products" || tile.key !== "red") {
      setSelectedProblemProducts(new Set());
      return;
    }
    setSelectedProblemProducts(new Set(rows.map((row) => row.name)));
  }, [rows, side, tile.key]);

  const activeExpandedProduct = useMemo(() => {
    if (!expandedProduct) return null;
    return rows.some((row) => row.name === expandedProduct) ? expandedProduct : null;
  }, [expandedProduct, rows]);

  const toggleProduct = useCallback((productName: string) => {
    setExpandedProduct((current) => (current === productName ? null : productName));
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

  const showProblemSelector = side === "products" && tile.key === "red" && rows.length > 0;
  const selectedProblemCount = selectedProblemProducts.size;

  const expandHint = expandableProducts
    ? tile.key === "red"
      ? "Нажмите на изделие, чтобы увидеть все номенклатуры спецификации."
      : "Нажмите на изделие, чтобы увидеть полный состав спецификации и дефициты."
    : null;

  const detailColumnCount = showAvailable ? 6 : 5;

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
            {optionalRows.length > 0
              ? ` Спорные номенклатуры показаны в таблице: ${optionalRows.length} поз.`
              : ""}
          </p>
          {optionalRows.length > 0 ? (
            <div className={styles.coverageMaterialLegend} aria-label="Легенда спорных номенклатур">
              <span className={styles.coverageMaterialLegendConsumable}>Возможно расходник</span>
              <span className={styles.coverageMaterialLegendWorkshop}>Возможно в цехе</span>
            </div>
          ) : null}
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
              {rows.map((row) => {
                const isExpanded = expandableProducts && activeExpandedProduct === row.name;
                const canExpand = expandableProducts;
                const materials = productMaterialLines(row);
                const panelId = `coverage-shortages-${row.name.replace(/[^\w-]+/g, "-")}`;
                const rowMaterialClass = row.optional ? materialKindClass(row.materialKind) : "";
                const rowKindLabel = materialKindLabel(row);

                return (
                  <Fragment key={row.name}>
                    <tr
                      className={
                        `${rowMaterialClass} ${
                          canExpand
                            ? `${styles.coverageDetailRowExpandable} ${
                              isExpanded ? styles.coverageDetailRowExpanded : ""
                            }`
                            : ""
                        }`.trim() || undefined
                      }
                      onClick={canExpand ? () => toggleProduct(row.name) : undefined}
                    >
                      <td className={styles.coverageDetailNameCell} title={row.name}>
                        {canExpand ? (
                          <button
                            type="button"
                            className={styles.coverageDetailExpandBtn}
                            aria-expanded={isExpanded}
                            aria-controls={panelId}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleProduct(row.name);
                            }}
                          >
                            <ChevronDown
                              size={14}
                              strokeWidth={2.2}
                              className={`${styles.coverageDetailExpandIcon} ${
                                isExpanded ? styles.coverageDetailExpandIconOpen : ""
                              }`}
                              aria-hidden="true"
                            />
                            <span>{row.name}</span>
                          </button>
                        ) : (
                          <span>{row.name}</span>
                        )}
                        {row.optional && rowKindLabel ? (
                          <span className={styles.coverageMaterialBadge}>{rowKindLabel}</span>
                        ) : null}
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
                    {isExpanded ? (
                      <tr className={styles.coverageDetailExpandRow}>
                        <td colSpan={detailColumnCount}>
                          <div id={panelId} className={styles.coverageShortagePanel}>
                            {materials.length === 0 ? (
                              <p className={styles.coverageShortageEmpty}>
                                Для этого изделия не найдена спецификация или номенклатуры не
                                определены.
                              </p>
                            ) : (
                              <>
                                <p className={styles.coverageShortageLead}>
                                  Номенклатуры спецификации для плана {formatQty(row.plan)} за период
                                </p>
                                <div className={styles.coverageBomScroll}>
                                  <table
                                    className={styles.coverageBomTable}
                                    aria-label={`Номенклатуры изделия ${row.name}`}
                                  >
                                    <colgroup>
                                      <col className={styles.coverageBomColName} />
                                      <col className={styles.coverageBomColQty} span={4} />
                                    </colgroup>
                                    <thead>
                                      <tr>
                                        <th scope="col">Номенклатура</th>
                                        <th scope="col">План</th>
                                        <th scope="col">Остаток</th>
                                        <th scope="col">Ожид. поступление</th>
                                        <th scope="col">Не хватает</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {materials.map((material) => {
                                        const materialClass = material.optional
                                          ? materialKindClass(material.materialKind)
                                          : "";
                                        const materialLabel = materialKindLabel(material);
                                        const hasShortage = material.shortage > 1e-9;
                                        return (
                                          <tr
                                            key={material.name}
                                            className={`${materialClass || ""} ${
                                              hasShortage ? styles.coverageBomRowShortage : ""
                                            }`.trim() || undefined}
                                          >
                                            <td
                                              className={styles.coverageShortageName}
                                              title={material.name}
                                            >
                                              <span className={styles.coverageShortageNameText}>
                                                {material.name}
                                              </span>
                                              {material.optional && materialLabel ? (
                                                <span className={styles.coverageMaterialBadge}>
                                                  {materialLabel}
                                                </span>
                                              ) : null}
                                            </td>
                                            <td>{formatQty(material.plan)}</td>
                                            <td>{formatQty(material.stock)}</td>
                                            <td>{formatQty(material.expected)}</td>
                                            <td
                                              className={
                                                hasShortage ? styles.coverageShortageValue : undefined
                                              }
                                            >
                                              {formatQty(material.shortage)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
                      <th>Изделия</th>
                      <th>План</th>
                      <th>Остаток</th>
                      <th>Ожид.</th>
                      <th>Не хватает</th>
                    </tr>
                  </thead>
                  <tbody>
                    {problemMaterials.map((item) => {
                      const itemClass = item.optional ? materialKindClass(item.materialKind) : "";
                      const itemLabel = materialKindLabel(item);
                      return (
                      <tr key={item.name} className={itemClass || undefined}>
                        <td className={styles.coverageProblemMaterialName}>
                          {item.name}
                          {item.optional && itemLabel ? (
                            <span className={styles.coverageMaterialBadge}>{itemLabel}</span>
                          ) : null}
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
      className={`${styles.riskAnalyticsTile} ${styles.riskTileFace} ${styles.riskTileFaceBack} ${toneClass(tile.tone)} ${styles.coverageTileBackFace}`}
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

function formatLiveUpdatedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
      return "Выполнено";
    case "partial":
      return "Частично";
    case "not_resolved":
      return "Не выполнено";
    case "active":
      return "Активно";
    default:
      return status || "—";
  }
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

const EXECUTIVE_REPORT_MODE_OPTIONS: Array<{ key: ExecutiveReportMode; label: string }> = [
  { key: "day", label: "День" },
  { key: "range", label: "Период" },
  { key: "all", label: "Всё время" }
];

const EXECUTIVE_REPORT_PRESETS = [
  { key: "week", label: "Эта неделя" },
  { key: "prev-week", label: "Прошлая неделя" },
  { key: "month", label: "Этот месяц" },
  { key: "30d", label: "30 дней" }
] as const;

function ExecutiveReportBar({
  bundle,
  formatDate
}: {
  bundle: ManagerResultsBundle;
  formatDate: (iso: string | null | undefined) => string;
}) {
  const [mode, setMode] = useState<ExecutiveReportMode>("day");
  const [rangeFrom, setRangeFrom] = useState(() => startOfIsoWeek(bundle.today));
  const [rangeTo, setRangeTo] = useState(bundle.today);
  const rangeFromRef = useRef<HTMLInputElement>(null);
  const rangeToRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode !== "range") return;
    setRangeTo((current) => (current > bundle.today ? bundle.today : current));
  }, [bundle.today, mode]);

  const earliestReportDate = useMemo(() => {
    if (bundle.availableDates.length === 0) return bundle.today;
    return bundle.availableDates.reduce(
      (earliest, entry) => (entry.reportDate < earliest ? entry.reportDate : earliest),
      bundle.availableDates[0].reportDate
    );
  }, [bundle.availableDates, bundle.today]);

  const daysWithReportsInRange = useMemo(() => {
    if (mode !== "range" || !rangeFrom || !rangeTo || rangeFrom > rangeTo) return 0;
    return bundle.availableDates.filter(
      (entry) => entry.reportDate >= rangeFrom && entry.reportDate <= rangeTo && entry.reportsCount > 0
    ).length;
  }, [bundle.availableDates, mode, rangeFrom, rangeTo]);

  const rangeInvalid = mode === "range" && Boolean(rangeFrom && rangeTo && rangeFrom > rangeTo);
  const rangeTooLong =
    mode === "range" &&
    Boolean(rangeFrom && rangeTo && rangeFrom <= rangeTo) &&
    Math.floor(
      (new Date(`${rangeTo}T12:00:00`).getTime() - new Date(`${rangeFrom}T12:00:00`).getTime()) /
        86400000
    ) +
      1 >
      365;

  const applyPreset = (preset: (typeof EXECUTIVE_REPORT_PRESETS)[number]["key"]) => {
    switch (preset) {
      case "week":
        setRangeFrom(startOfIsoWeek(bundle.today));
        setRangeTo(bundle.today);
        break;
      case "prev-week": {
        const prevWeekEnd = addIsoDays(startOfIsoWeek(bundle.today), -1);
        setRangeFrom(addIsoDays(prevWeekEnd, -6));
        setRangeTo(prevWeekEnd);
        break;
      }
      case "month":
        setRangeFrom(startOfIsoMonth(bundle.today));
        setRangeTo(bundle.today);
        break;
      case "30d":
        setRangeFrom(addIsoDays(bundle.today, -29));
        setRangeTo(bundle.today);
        break;
      default:
        break;
    }
  };

  const buttonLabel = useMemo(() => {
    if (bundle.executiveReportLoading) return "Формируем…";
    if (mode === "day") return `Сформировать Excel · ${formatDate(bundle.selectedDate)}`;
    if (mode === "all") return "Сформировать Excel · всё время";
    if (rangeFrom && rangeTo && !rangeInvalid) {
      return `Сформировать Excel · ${formatExecutiveReportRangeLabel(rangeFrom, rangeTo)}`;
    }
    return "Сформировать Excel";
  }, [
    bundle.executiveReportLoading,
    bundle.selectedDate,
    formatDate,
    mode,
    rangeFrom,
    rangeTo,
    rangeInvalid
  ]);

  const handleDownload = () => {
    if (!bundle.onExecutiveReportDownload || bundle.executiveReportLoading) return;
    if (mode === "day") {
      bundle.onExecutiveReportDownload({ mode, reportDate: bundle.selectedDate });
      return;
    }
    if (mode === "all") {
      bundle.onExecutiveReportDownload({ mode });
      return;
    }
    if (!rangeFrom || !rangeTo || rangeInvalid || rangeTooLong) return;
    bundle.onExecutiveReportDownload({ mode, dateFrom: rangeFrom, dateTo: rangeTo });
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

        <div className={styles.managerResultsReportModeNav} role="tablist" aria-label="Период сводного отчёта">
          {EXECUTIVE_REPORT_MODE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={mode === option.key}
              className={`${styles.coveragePeriodBtn} ${
                mode === option.key ? styles.coveragePeriodBtnActive : ""
              }`}
              onClick={() => setMode(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {mode === "day" ? (
          <div className={styles.managerResultsReportModePanel}>
            <p className={styles.managerResultsReportModeSummary}>
              За день{" "}
              <strong>
                {formatDate(bundle.selectedDate)}, {formatWeekdayShort(bundle.selectedDate)}
              </strong>
            </p>
            <p className={styles.managerResultsReportModeMeta}>
              Синхронизировано с датой в панели выше. Обеспеченность — на этот же день.
            </p>
          </div>
        ) : null}

        {mode === "range" ? (
          <div className={styles.managerResultsReportModePanel}>
            <div className={styles.managerResultsReportRangeRow}>
              <label className={styles.managerResultsReportRangeField}>
                <span>С</span>
                <button
                  type="button"
                  className={styles.managerResultsReportRangeBtn}
                  onClick={() => {
                    rangeFromRef.current?.showPicker?.();
                    rangeFromRef.current?.focus();
                  }}
                >
                  <CalendarDays size={14} strokeWidth={2.2} aria-hidden="true" />
                  <span>{formatDate(rangeFrom)}</span>
                  <input
                    ref={rangeFromRef}
                    type="date"
                    className={styles.managerResultsDateInputHidden}
                    value={rangeFrom}
                    max={rangeTo || bundle.today}
                    onChange={(event) => {
                      if (event.target.value) setRangeFrom(event.target.value);
                    }}
                    aria-label="Начало периода"
                  />
                </button>
              </label>
              <span className={styles.managerResultsReportRangeDash} aria-hidden="true">
                —
              </span>
              <label className={styles.managerResultsReportRangeField}>
                <span>По</span>
                <button
                  type="button"
                  className={styles.managerResultsReportRangeBtn}
                  onClick={() => {
                    rangeToRef.current?.showPicker?.();
                    rangeToRef.current?.focus();
                  }}
                >
                  <CalendarDays size={14} strokeWidth={2.2} aria-hidden="true" />
                  <span>{formatDate(rangeTo)}</span>
                  <input
                    ref={rangeToRef}
                    type="date"
                    className={styles.managerResultsDateInputHidden}
                    value={rangeTo}
                    min={rangeFrom}
                    max={bundle.today}
                    onChange={(event) => {
                      if (event.target.value) setRangeTo(event.target.value);
                    }}
                    aria-label="Конец периода"
                  />
                </button>
              </label>
            </div>
            <div className={styles.managerResultsReportPresetRow}>
              {EXECUTIVE_REPORT_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={styles.managerResultsReportPresetBtn}
                  onClick={() => applyPreset(preset.key)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {rangeInvalid ? (
              <p className={styles.managerResultsReportModeError}>Дата начала не может быть позже даты окончания.</p>
            ) : rangeTooLong ? (
              <p className={styles.managerResultsReportModeError}>Максимальная длина периода — 365 дней.</p>
            ) : (
              <p className={styles.managerResultsReportModeMeta}>
                {daysWithReportsInRange > 0
                  ? `${daysWithReportsInRange} ${
                      daysWithReportsInRange === 1
                        ? "день"
                        : daysWithReportsInRange < 5
                          ? "дня"
                          : "дней"
                    } с отчётами менеджеров в выбранном диапазоне.`
                  : "В выбранном диапазоне пока нет закрытых смен — отчёт всё равно можно сформировать."}
              </p>
            )}
          </div>
        ) : null}

        {mode === "all" ? (
          <div className={styles.managerResultsReportModePanel}>
            <p className={styles.managerResultsReportModeSummary}>
              Все смены с <strong>{formatDate(earliestReportDate)}</strong> по{" "}
              <strong>{formatDate(bundle.today)}</strong>
            </p>
            <p className={styles.managerResultsReportModeMeta}>
              Агрегируются все закрытые смены менеджеров. Обеспеченность и закупки — на сегодня.
            </p>
          </div>
        ) : null}
      </div>

      {bundle.onExecutiveReportDownload ? (
        <button
          type="button"
          className={styles.managerResultsReportBtn}
          disabled={
            bundle.executiveReportLoading ||
            rangeInvalid ||
            rangeTooLong ||
            (mode === "range" && (!rangeFrom || !rangeTo))
          }
          onClick={handleDownload}
        >
          {buttonLabel}
        </button>
      ) : null}
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

function ManagerResultsDateNav({
  bundle,
  formatDate
}: {
  bundle: ManagerResultsBundle;
  formatDate: (iso: string | null | undefined) => string;
}) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const isToday = bundle.selectedDate === bundle.today;

  return (
    <div className={styles.managerResultsDateNav} role="group" aria-label="Выбор даты отчёта">
      <button
        type="button"
        className={styles.managerResultsDateArrow}
        aria-label="Предыдущий день"
        onClick={() => bundle.onDateChange(addIsoDays(bundle.selectedDate, -1))}
      >
        <ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.managerResultsDatePickerBtn}
        aria-label="Выбрать дату"
        onClick={() => {
          dateInputRef.current?.showPicker?.();
          dateInputRef.current?.focus();
        }}
      >
        <CalendarDays size={15} strokeWidth={2.2} aria-hidden="true" />
        <span>{formatDate(bundle.selectedDate)}</span>
        <span className={styles.managerResultsDateWeekday}>{formatWeekdayShort(bundle.selectedDate)}</span>
        <input
          ref={dateInputRef}
          type="date"
          className={styles.managerResultsDateInputHidden}
          value={bundle.selectedDate}
          onChange={(event) => {
            if (event.target.value) bundle.onDateChange(event.target.value);
          }}
          aria-label="Дата отчёта"
        />
      </button>
      <button
        type="button"
        className={styles.managerResultsDateArrow}
        aria-label="Следующий день"
        onClick={() => bundle.onDateChange(addIsoDays(bundle.selectedDate, 1))}
      >
        <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
      </button>
      {!isToday ? (
        <button
          type="button"
          className={styles.managerResultsTodayBtn}
          onClick={() => bundle.onDateChange(bundle.today)}
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
        <RefreshCw size={14} strokeWidth={2.4} className={bundle.loading ? styles.managerResultsSpin : ""} aria-hidden="true" />
      </button>
    </div>
  );
}

function ManagerResultsDateStrip({
  bundle,
  formatDate
}: {
  bundle: ManagerResultsBundle;
  formatDate: (iso: string | null | undefined) => string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLElement>(`[data-report-date="${bundle.selectedDate}"]`);
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [bundle.selectedDate, bundle.availableDates.length]);

  if (bundle.availableDates.length === 0) return null;

  return (
    <div className={styles.managerResultsDateStripWrap}>
      <p className={styles.managerResultsDateStripLabel}>Дни с отчётами и live-сменами</p>
      <div ref={stripRef} className={styles.managerResultsDateStrip} role="listbox" aria-label="Дни с завершёнными сменами">
        {bundle.availableDates.map((entry) => {
          const active = entry.reportDate === bundle.selectedDate;
          const liveOnly = entry.hasLive && entry.reportsCount === 0;
          return (
            <button
              key={entry.reportDate}
              type="button"
              role="option"
              aria-selected={active}
              data-report-date={entry.reportDate}
              className={`${styles.managerResultsDateChip} ${
                active ? styles.managerResultsDateChipActive : ""
              } ${liveOnly ? styles.managerResultsDateChipLive : ""}`}
              onClick={() => bundle.onDateChange(entry.reportDate)}
            >
              <span>{formatDate(entry.reportDate)}</span>
              <span className={styles.managerResultsDateChipMeta}>
                {formatWeekdayShort(entry.reportDate)} ·{" "}
                {liveOnly
                  ? "live"
                  : `${entry.reportsCount}/${entry.rosterTotal || bundle.dashboard?.roster.total || 2} ${
                      entry.reportsCount === 1 ? "отчёт" : entry.reportsCount < 5 ? "отчёта" : "отчётов"
                    }`}
              </span>
            </button>
          );
        })}
      </div>
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

function ManagerResultTaskList({ tasks }: { tasks: ManagerCompletionTask[] }) {
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
        return (
          <article
            key={`${taskValue(task, "key")}-${title}-${taskType}`}
            className={styles.managerResultTaskRow}
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
                {deadline ? ` · срок ${deadline}` : ""}
              </p>
              {resultText ? <p className={styles.managerResultTaskResult}>{resultText}</p> : null}
              {reason && status !== "resolved" ? (
                <blockquote className={styles.managerResultTaskReason}>{reason}</blockquote>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ManagerResultPanel({ manager }: { manager: ManagerCompletionReport }) {
  const [taskFilter, setTaskFilter] = useState<ManagerTaskTileFilter>("remaining");
  const isMissing = manager.reportStatus === "missing";
  const isInProgress = manager.reportStatus === "in_progress";
  const reportKind = isInProgress ? "live" : "submitted";
  const liveUpdatedLabel = formatLiveUpdatedAt(manager.liveUpdatedAt);
  const filteredTasks = useMemo(
    () => getFilteredManagerTasks(manager, taskFilter, reportKind),
    [manager, reportKind, taskFilter]
  );

  useEffect(() => {
    setTaskFilter("remaining");
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
            За этот день менеджер не нажал «Завершить смену» — отчёт не поступил. Данные по заданиям недоступны.
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
              <span className={`${styles.managerResultStatusPill} ${styles.managerResultStatusPill_live}`}>
                <span className={styles.managerResultsLiveDot} aria-hidden="true" />
                Live · смена не закрыта
              </span>
              {liveUpdatedLabel ? (
                <p className={styles.managerResultsLiveMeta}>Обновлено в {liveUpdatedLabel}</p>
              ) : (
                <p className={styles.managerResultsLiveMeta}>Прогресс обновляется автоматически</p>
              )}
            </div>
            <ManagerProgressRing stats={manager.stats} />
          </div>
          <ManagerResultTiles
            stats={manager.stats}
            filter={taskFilter}
            remainingLabel="Осталось"
            onFilterChange={setTaskFilter}
          />
          <div className={styles.managerResultBreakdown}>
            <span>Активно: {manager.stats.active}</span>
            <span>Частично: {manager.stats.partial}</span>
            <span>Не выполнено: {manager.stats.notResolved}</span>
          </div>
        </div>

        <div className={styles.managerResultPanelScroll}>
          <section
            className={styles.managerResultTasksBlock}
            aria-label={`${managerTaskFilterTitle(taskFilter, "live")} ${manager.managerName}`}
          >
            <div className={styles.managerResultTasksBlockHead}>
              <h4>{managerTaskFilterTitle(taskFilter, "live")}</h4>
              <span className={styles.managerResultTasksCount}>{filteredTasks.length}</span>
            </div>
            {filteredTasks.length > 0 ? (
              <ManagerResultTaskList tasks={filteredTasks} />
            ) : (
              <p className={styles.managerResultsEmptyCompact}>
                {managerTaskFilterEmpty(taskFilter, "live")}
              </p>
            )}
          </section>
        </div>
      </article>
    );
  }

  return (
    <article className={styles.managerResultPanel}>
      <div className={styles.managerResultAnalytics}>
        <div className={styles.managerResultCardHead}>
          <div>
            <p className={styles.managerResultEyebrow}>Менеджер</p>
            <h3>{manager.managerName}</h3>
            {manager.regionLabel ? (
              <p className={styles.managerResultRegionLabel}>{manager.regionLabel}</p>
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
        <div className={styles.managerResultBreakdown}>
          <span>Активно: {manager.stats.active}</span>
          <span>Частично: {manager.stats.partial}</span>
          <span>Не выполнено: {manager.stats.notResolved}</span>
        </div>
      </div>

      <div className={styles.managerResultPanelScroll}>
        <section
          className={styles.managerResultTasksBlock}
          aria-label={`${managerTaskFilterTitle(taskFilter, "submitted")} ${manager.managerName}`}
        >
          <div className={styles.managerResultTasksBlockHead}>
            <h4>{managerTaskFilterTitle(taskFilter, "submitted")}</h4>
            <span className={styles.managerResultTasksCount}>{filteredTasks.length}</span>
          </div>
          {filteredTasks.length > 0 ? (
            <ManagerResultTaskList tasks={filteredTasks} />
          ) : (
            <p className={styles.managerResultsEmptyCompact}>
              {managerTaskFilterEmpty(taskFilter, "submitted")}
            </p>
          )}
        </section>
      </div>
    </article>
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
  const hasData = Boolean(dashboard && dashboard.managers.length > 0);
  const hasReportsForDate = bundle.availableDates.some(
    (entry) => entry.reportDate === bundle.selectedDate
  );
  const roster = dashboard?.roster ?? { total: 2, submitted: 0, inProgress: 0, missing: 2 };
  const isLiveDay = Boolean(dashboard?.liveMode && bundle.selectedDate === bundle.today);
  const summaryGrid =
    dashboard && !bundle.loading && !bundle.error && hasData ? (
      <div className={styles.managerResultsSummaryGrid}>
        <article className={styles.managerResultsSummaryCard}>
          <span>Отчётов сдано</span>
          <strong>
            {roster.submitted}/{roster.total}
          </strong>
        </article>
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
        {isLiveDay ? (
          <div className={styles.managerResultsLiveBanner} role="status">
            <span className={styles.managerResultsLiveDot} aria-hidden="true" />
            <span>
              Live-режим: смена ещё не закрыта, прогресс менеджеров обновляется автоматически каждые 30 секунд.
            </span>
          </div>
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
            {hasReportsForDate
              ? "Отчёты за эту дату ещё обрабатываются или данные недоступны."
              : bundle.selectedDate === bundle.today
                ? "Сменное задание ещё не сформировано — выполните анализ Excel, чтобы менеджеры получили задания."
                : "За выбранный день менеджеры ещё не завершали смену."}
          </p>
          {bundle.availableDates.length > 0 ? (
            <p className={styles.managerResultsEmptyHint}>
              Выберите другую дату в панели выше — доступно {bundle.availableDates.length}{" "}
              {bundle.availableDates.length === 1 ? "день" : bundle.availableDates.length < 5 ? "дня" : "дней"} с отчётами.
            </p>
          ) : null}
        </div>
      ) : dashboard ? (
          <>
            {roster.inProgress > 0 ? (
              <p className={styles.managerResultsRosterHintLive}>
                {roster.inProgress === roster.total
                  ? "Все менеджеры в live-режиме — смена ещё не закрыта, прогресс обновляется в реальном времени."
                  : `${roster.inProgress} из ${roster.total} менеджеров работают над сменным заданием в live-режиме.`}
              </p>
            ) : null}
            {roster.missing > 0 && roster.inProgress === 0 ? (
              <p className={styles.managerResultsRosterHint}>
                {roster.missing === roster.total
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
                <ManagerResultPanel key={manager.id} manager={manager} />
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
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
  managerTasks?: ShiftTaskBoardProps | null;
  managerTasksNotice?: ManagerTasksNotice | null;
  managerResults?: ManagerResultsBundle | null;
};

export function CoverageDashboardTiles({
  dashboard,
  formatDate = formatRuDate,
  onFetchCustomPeriod,
  managerTasks = null,
  managerTasksNotice = null,
  managerResults = null
}: CoverageDashboardTilesProps) {
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
                        className={`${styles.riskAnalyticsTile} ${styles.riskTileFace} ${styles.riskTileFaceFront} ${toneClass(tile.tone)} ${styles.coverageTileFront} ${
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
                            className={`${styles.riskAnalyticsTileIcon} ${iconToneClass(tile.tone)}`}
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
    <div className={styles.coverageModeSwitch} role="tablist" aria-label="Тип дашборда">
      <button
        type="button"
        role="tab"
        aria-selected={isProductsMode}
        className={`${styles.coverageModeSwitchBtn} ${
          isProductsMode ? styles.coverageModeSwitchBtnActive : ""
        }`}
        onClick={() => selectDashboardSide("products")}
      >
        <Package size={14} strokeWidth={2.2} aria-hidden="true" />
        Изделия
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isNomenclaturesMode}
        className={`${styles.coverageModeSwitchBtn} ${
          isNomenclaturesMode ? styles.coverageModeSwitchBtnActive : ""
        }`}
        onClick={() => selectDashboardSide("nomenclatures")}
      >
        <Layers size={14} strokeWidth={2.2} aria-hidden="true" />
        Номенклатуры
      </button>
      {hasTasksSide ? (
        <button
          type="button"
          role="tab"
          aria-selected={isTasksMode}
          className={`${styles.coverageModeSwitchBtn} ${
            isTasksMode ? styles.coverageModeSwitchBtnActive : ""
          }`}
          onClick={() => selectDashboardSide("tasks")}
        >
          <ClipboardList size={14} strokeWidth={2.2} aria-hidden="true" />
          Задания
        </button>
      ) : null}
      {hasManagerResultsSide ? (
        <button
          type="button"
          role="tab"
          aria-selected={isManagerResultsMode}
          className={`${styles.coverageModeSwitchBtn} ${
            isManagerResultsMode ? styles.coverageModeSwitchBtnActive : ""
          }`}
          onClick={() => selectDashboardSide("manager_results")}
        >
          <ClipboardList size={14} strokeWidth={2.2} aria-hidden="true" />
          Результаты
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
      <div className={styles.coverageToolbarTrailing}>{dashboardModeSwitch}</div>
    </div>
  );

  const tasksToolbar = (
    <div
      className={`${styles.coverageToolbar} ${styles.coverageToolbarTasksOnly}`}
      role="toolbar"
      aria-label="Тип дашборда"
    >
      {dashboardModeSwitch}
    </div>
  );

  const managerResultsToolbar = managerResults ? (
    <div
      className={`${styles.coverageToolbar} ${styles.coverageToolbarManagerResults}`}
      role="toolbar"
      aria-label="Аналитика менеджеров"
    >
      <ManagerResultsDateNav bundle={managerResults} formatDate={formatDate} />
      <span className={styles.coverageToolbarDivider} aria-hidden="true" />
      {dashboardModeSwitch}
    </div>
  ) : (
    tasksToolbar
  );

  return (
    <div
      className={`${styles.coverageEmbeddedBlock} ${
        isManagerResultsMode ? styles.coverageEmbeddedBlockManagerResults : ""
      } ${isTasksMode ? styles.coverageEmbeddedBlockTasks : ""}`}
    >
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
        <div className={styles.coverageDashboardControls}>
          {isManagerResultsMode
            ? managerResultsToolbar
            : isTasksMode
              ? tasksToolbar
              : periodNav}
        </div>
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
  );
}

type CoverageDashboardProps = {
  dashboard: CoverageDashboardPayload | null;
  formatDate?: (iso: string | null | undefined) => string;
  onFetchCustomPeriod?: (dateFrom: string, dateTo: string) => Promise<CoveragePeriodPayload | null>;
  managerTasks?: ShiftTaskBoardProps | null;
  managerTasksNotice?: ManagerTasksNotice | null;
  managerResults?: ManagerResultsBundle | null;
};

export function CoverageDashboard({
  dashboard,
  formatDate = formatRuDate,
  onFetchCustomPeriod,
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
        managerTasks={managerTasks}
        managerTasksNotice={managerTasksNotice}
        managerResults={managerResults}
      />
    </section>
  );
}

export { mapCoverageDashboard };
