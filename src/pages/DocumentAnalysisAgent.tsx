import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type TransitionEvent
} from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CloudUpload,
  Download,
  FileSearch,
  FileSpreadsheet,
  Layers,
  Loader2,
  Package,
  ShieldCheck,
  Siren,
  CheckCircle2,
  Info,
  Trash2,
  Upload
} from "lucide-react";
import { TempOnecSyncHint } from "./temp/TempOnecSyncFreshness";
import {
  TempOnecSyncProgress,
  type OnecSyncProgressView,
} from "./temp/TempOnecSyncProgress";
import { TempOnecSyncResult } from "./temp/TempOnecSyncResult";
import {
  parseOnecManualSyncMessage,
  sanitizeOnecErrorMessage,
  type OnecManualSyncMessageView,
} from "./temp/onecSyncFreshness";
import ScheduleFlipModal, { type ScheduleFlipFace } from "./temp/ScheduleFlipModal";
import type { MergedShipmentStats } from "./temp/TempMergedShipmentViewer";
import ShiftTaskBoard, { ShiftTasksNewDayNotice } from "./temp/ShiftTaskBoard";
import AvionDeveloperFeedbackWidget from "./temp/AvionDeveloperFeedbackWidget";
import SummaryReferencePanel from "./temp/SummaryReferencePanel";
import { useAveonReferenceCache } from "./temp/useAveonReferenceCache";
import {
  buildInitialResultTexts,
  buildColIndexByHeader,
  type ShiftResultEvalState,
} from "./temp/shiftAssignmentProgress";
import type { ShiftAssignmentMeta, ShiftAssignmentRowKind } from "./temp/shiftAssignmentTypes";
import {
  applyShiftManagerScopeToAssignment,
  resolveShiftManagerScope,
} from "./temp/shiftManagerAccess";
import { useAuth } from "@/auth/AuthContext";
import { useTempOnecSyncStatus } from "./temp/useTempOnecSyncStatus";
import {
  documentAnalysisAcceptedExtensions,
  documentAnalysisAgentSubtitle,
  isAcceptedAnalysisFile,
  mockDocumentAnalysisAgent
} from "@/mock-data/documentAnalysisAgent";
import { agentsApi } from "@/api/endpoints";
import { openWorkbookInNewTab } from "@/utils/workbookPreviewStore";
import {
  CoverageDashboard,
  parseCoverageDashboard,
  parseCoveragePeriod,
  type CoverageDashboardPayload,
  type CoveragePeriodPayload,
  type ManagerCompletionDashboard,
  type ManagerCompletionDateEntry,
  type ManagerResultsBundle,
  type ExecutiveReportDownloadParams
} from "@/pages/temp/CoverageDashboard";
import CoverageDashboardLoading from "@/pages/temp/CoverageDashboardLoading";
import styles from "./DocumentAnalysisAgent.module.css";

function todayMskIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
}

type FileRoleStatus = "pending" | "loading" | "ready" | "error";
type ShipmentMergeStatus = "merging" | "done";

interface StagedFile {
  id: string;
  file: File;
  role: string | null;
  roleStatus: FileRoleStatus;
  /** Склеенный график отгрузок из нескольких исходников */
  isMergedShipment?: boolean;
  mergedSourceCount?: number;
  mergeStatus?: ShipmentMergeStatus;
}

type ScheduleComparisonNotice = {
  kind: "baseline" | "changed" | "unchanged";
  fileName: string;
  fileBase64: string;
  months: string[];
  message: string;
  oldVersion: string;
  newVersion: string;
  cells: number;
};

type DetailedComparisonNotice = {
  kind: "baseline" | "changed" | "unchanged";
  fileName: string;
  fileBase64: string;
  dates: string[];
  message: string;
  oldVersion: string;
  newVersion: string;
  cells: number;
};

type RussiaShipmentSource = {
  id: string;
  file_name: string;
  file_sha256: string;
  created_at?: string | null;
  updated_at?: string | null;
  stats?: Record<string, unknown>;
};

type ShipmentManualChangeNotice = {
  id: string;
  message: string;
  nomenclature?: string;
  country?: string | null;
  changedCells: Array<{ row: number; col: number }>;
};

const analysisStages = [
  "Загружаем Excel и определяем роли файлов",
  "Сопоставляем изделия, спецификации и материалы",
  "Подставляем поставщика, цену и остатки из 1С",
  "Считаем потребность, логистику и обеспеченность",
  "Формируем план заказов и result.xlsx"
] as const;

function logAveonScheduleSnapshotStatus(): void {
  void agentsApi
    .getAveonScheduleSnapshotStatus()
    .then((status) => {
      if (!status?.ok) return;
      const logPrefix = "[Aveon графики]";
      if (status.has_production && status.production_filename) {
        const version = status.production_version ? ` · v${status.production_version}` : "";
        console.info(
          `${logPrefix} старая версия графика производства (из БД): ${status.production_filename}${version}`
        );
      } else {
        console.info(`${logPrefix} старая версия графика производства (из БД): не сохранена`);
      }
      if (status.has_detailed && status.detailed_schedules?.length) {
        for (const item of status.detailed_schedules) {
          if (!item.has_file || !item.filename) continue;
          const version = item.version_label ? ` · v${item.version_label}` : "";
          console.info(
            `${logPrefix} старая версия детального графика за ${item.month} (из БД): ${item.filename}${version}`
          );
        }
      } else {
        console.info(`${logPrefix} старая версия детального графика (из БД): не сохранена`);
      }
    })
    .catch(() => {
      // snapshot недоступен — не мешаем работе агента
    });
}

type AnalysisInputSourceEntry = {
  source?: string;
  source_label?: string;
  files?: string[];
  detail?: string;
};

type AnalysisInputSources = {
  summary?: { mode?: string; text?: string };
  uploaded_files?: Array<{ filename: string; role: string }>;
  server_injected_files?: string[];
  production_schedule?: AnalysisInputSourceEntry;
  detailed_production_schedule?: AnalysisInputSourceEntry;
  specifications?: AnalysisInputSourceEntry;
  stock?: AnalysisInputSourceEntry;
  shipment_schedule?: AnalysisInputSourceEntry;
};

const INPUT_SOURCE_BLOCK_LABELS: Record<string, string> = {
  production_schedule: "План производства (помесячный)",
  detailed_production_schedule: "Детальный план производства",
  specifications: "Спецификации и материалы",
  stock: "Остатки",
  shipment_schedule: "График отгрузок"
};

function logAnalysisInputSources(
  inputSources: AnalysisInputSources | null | undefined,
  stagedFiles: Array<{ file: File; role: string | null }>
): void {
  console.log("===========");
  console.log("[Анализ] Источники данных");
  if (!inputSources) {
    console.log("(метаданные источников не получены с сервера)");
    return;
  }
  if (inputSources.summary?.text) {
    console.log("Итого:", inputSources.summary.text);
  }
  if (inputSources.summary?.mode) {
    console.log("Режим:", inputSources.summary.mode);
  }
  console.log("---");
  if (inputSources.uploaded_files?.length) {
    console.log("Файлы, загруженные пользователем:");
    inputSources.uploaded_files.forEach((item, index) => {
      const roleLabel = ROLE_LABELS[item.role] ?? item.role;
      console.log(`  ${index + 1}. ${item.filename} → ${roleLabel}`);
    });
  } else if (stagedFiles.length) {
    console.log("Файлы, загруженные пользователем:");
    stagedFiles.forEach((item, index) => {
      const roleLabel = item.role ? (ROLE_LABELS[item.role] ?? item.role) : "роль не определена";
      console.log(`  ${index + 1}. ${item.file.name} → ${roleLabel}`);
    });
  }
  if (inputSources.server_injected_files?.length) {
    console.log("Добавлено сервером:", inputSources.server_injected_files.join(", "));
  }
  console.log("---");
  for (const [key, blockLabel] of Object.entries(INPUT_SOURCE_BLOCK_LABELS)) {
    const entry = inputSources[key as keyof AnalysisInputSources];
    if (!entry || typeof entry !== "object" || !("source" in entry)) continue;
    const sourceEntry = entry as AnalysisInputSourceEntry;
    const filesLabel = sourceEntry.files?.length ? sourceEntry.files.join(", ") : "—";
    console.log(`${blockLabel}: ${sourceEntry.source_label ?? sourceEntry.source ?? "—"}`);
    console.log(`  файлы: ${filesLabel}`);
    if (sourceEntry.detail) {
      console.log(`  ${sourceEntry.detail}`);
    }
  }
  console.log("===========");
}

/** Опциональные Excel-файлы пользователя (переопределяют данные из БД). */
const requiredFileRoles = [
  {
    role: "production_schedule",
    label: "План производства (Excel)",
    hint: "опционально · переопределяет годовой график из БД · сравнение с сохранённой версией",
    required: false
  },
  {
    role: "detailed_production_schedule",
    label: "Детальный план (Excel)",
    hint: "по дням / неделям · переопределяет план из 1С · сравнение с сохранённой версией",
    required: false
  }
] as const;

type LogisticsRiskStageView = {
  key: string;
  label: string;
  items: Array<{
    nomenclature: string;
    supplier: string | null;
    quantity: number;
    moscowDate: string;
    milestoneDate: string;
    sheet: string;
    windowStart: string;
    windowEnd: string;
    daysRemaining: number;
    riskRatio: number;
    riskLevel: string;
  }>;
};

type LogisticsRiskItem = LogisticsRiskStageView["items"][number];

type SupplierGroup = {
  key: string;
  label: string;
  isUnknown: boolean;
  items: LogisticsRiskItem[];
};

type RiskItemFilter = "all" | "at_risk" | "on_track" | "critical";

const UNKNOWN_SUPPLIER_LABEL = "Поставщик не найден";
const VIRTUAL_STAGE_PREFIX = "virtual:";

type RiskTileMeta = {
  filter: RiskItemFilter;
  label: string;
  tone: "default" | "danger" | "success" | "critical";
  backTitle: string;
  backRule: string;
  backHint: string;
};

const RISK_TILES: RiskTileMeta[] = [
  {
    filter: "all",
    label: "Всего в точках",
    tone: "default",
    backTitle: "Как считается",
    backRule:
      "Сумма позиций во всех контрольных точках на сегодня: загрузка, МСК, таможня, Ростов. Одна номенклатура может попасть в несколько стадий.",
    backHint: "ЛКМ: стадия ↔ все позиции"
  },
  {
    filter: "at_risk",
    label: "Под риском",
    tone: "danger",
    backTitle: "Как считается",
    backRule:
      "Позиция под риском, если уровень critical/high или до крайней даты окна остался ≤ 1 день. Сводка — по всем точкам сразу.",
    backHint: "ЛКМ: стадия ↔ все под риском"
  },
  {
    filter: "on_track",
    label: "Успевают",
    tone: "success",
    backTitle: "Как считается",
    backRule:
      "Все позиции, которые не попали в «под риском»: запас дней до крайней даты окна ещё достаточный.",
    backHint: "ЛКМ: стадия ↔ все успевающие"
  },
  {
    filter: "critical",
    label: "Критичные",
    tone: "critical",
    backTitle: "Как считается",
    backRule:
      "Крайний день или просрочка: daysRemaining ≤ 0 (сегодня = крайняя дата окна или уже позже).",
    backHint: "ЛКМ: стадия ↔ все критичные"
  }
];

const VIRTUAL_STAGE_LABELS: Record<RiskItemFilter, string> = {
  all: "Все позиции",
  at_risk: "Под риском",
  on_track: "Успевают",
  critical: "Критичные"
};

function virtualStageKey(filter: RiskItemFilter): string {
  return `${VIRTUAL_STAGE_PREFIX}${filter}`;
}

function parseVirtualStageFilter(key: string): RiskItemFilter | null {
  if (!key.startsWith(VIRTUAL_STAGE_PREFIX)) return null;
  const filter = key.slice(VIRTUAL_STAGE_PREFIX.length);
  if (filter === "all" || filter === "at_risk" || filter === "on_track" || filter === "critical") {
    return filter;
  }
  return null;
}

function isItemAtRisk(item: LogisticsRiskItem): boolean {
  return item.riskLevel === "critical" || item.riskLevel === "high" || item.daysRemaining <= 1;
}

function isItemOnTrack(item: LogisticsRiskItem): boolean {
  return !isItemAtRisk(item);
}

function isItemCritical(item: LogisticsRiskItem): boolean {
  return item.daysRemaining <= 0;
}

function filterRiskItems(items: LogisticsRiskItem[], filter: RiskItemFilter): LogisticsRiskItem[] {
  switch (filter) {
    case "at_risk":
      return items.filter(isItemAtRisk);
    case "on_track":
      return items.filter(isItemOnTrack);
    case "critical":
      return items.filter(isItemCritical);
    default:
      return items;
  }
}

const RISK_STAGE_NAV_LABELS: Record<string, string> = {
  loading_dispatch: "Загрузка",
  msk_arrival: "МСК",
  customs_clearance: "Таможня",
  rostov_arrival: "Ростов"
};

function riskLevelClass(level: string): string {
  switch (level) {
    case "low":
      return styles.riskLevelLow;
    case "medium":
      return styles.riskLevelMedium;
    case "high":
      return styles.riskLevelHigh;
    default:
      return styles.riskLevelCritical;
  }
}

function formatDaysRemaining(days: number): string {
  if (days <= 0) return "крайний день / риск";
  if (days === 1) return "остался 1 день до крайней даты";
  if (days >= 2 && days <= 4) return `осталось ${days} дня до крайней даты`;
  return `осталось ${days} дней до крайней даты`;
}

function getDefaultRiskStageKey(stages: LogisticsRiskStageView[]): string {
  const firstWithItems = stages.find((stage) => stage.items.length > 0);
  return firstWithItems?.key ?? stages[0]?.key ?? "";
}

function toDomId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "id";
}

function groupItemsBySupplier(items: LogisticsRiskItem[]): SupplierGroup[] {
  const groups = new Map<string, SupplierGroup>();

  for (const item of items) {
    const raw = item.supplier?.trim();
    const isUnknown = !raw;
    const label = raw || UNKNOWN_SUPPLIER_LABEL;
    const key = isUnknown ? "__unknown__" : raw;

    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, { key, label, isUnknown, items: [item] });
    }
  }

  const sorted = [...groups.values()];
  sorted.sort((a, b) => {
    if (a.isUnknown && !b.isUnknown) return 1;
    if (!a.isUnknown && b.isUnknown) return -1;
    const aMin = Math.min(...a.items.map((item) => item.daysRemaining));
    const bMin = Math.min(...b.items.map((item) => item.daysRemaining));
    if (aMin !== bMin) return aMin - bMin;
    return a.label.localeCompare(b.label, "ru");
  });

  for (const group of sorted) {
    group.items.sort((a, b) => {
      if (a.daysRemaining !== b.daysRemaining) {
        return a.daysRemaining - b.daysRemaining;
      }
      if (a.riskRatio !== b.riskRatio) {
        return a.riskRatio - b.riskRatio;
      }
      return a.nomenclature.localeCompare(b.nomenclature, "ru");
    });
  }

  return sorted;
}

type RiskDoughnutChartProps = {
  onTrack: number;
  atRisk: number;
  total: number;
  onSelectFilter?: (filter: RiskItemFilter) => void;
};

type DoughnutSegmentKey = "on_track" | "at_risk";

/** Дуга кольца: start/end — доли круга [0..1] от 12 часов по часовой. */
function doughnutArcPath(
  cx: number,
  cy: number,
  radius: number,
  startShare: number,
  endShare: number
): string {
  const startAngle = startShare * Math.PI * 2 - Math.PI / 2;
  const endAngle = endShare * Math.PI * 2 - Math.PI / 2;
  const x1 = cx + radius * Math.cos(startAngle);
  const y1 = cy + radius * Math.sin(startAngle);
  const x2 = cx + radius * Math.cos(endAngle);
  const y2 = cy + radius * Math.sin(endAngle);
  const largeArc = endShare - startShare > 0.5 ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function RiskDoughnutChart({ onTrack, atRisk, total, onSelectFilter }: RiskDoughnutChartProps) {
  const size = 156;
  const stroke = 16;
  const hoverStroke = 19;
  const pad = 14;
  const radius = (size - stroke) / 2;
  const centerX = size / 2;
  const centerY = size / 2;
  const [hoveredSegment, setHoveredSegment] = useState<DoughnutSegmentKey | null>(null);

  const atRiskShare = total > 0 ? atRisk / total : 0;
  const onTrackShare = total > 0 ? onTrack / total : 0;
  const centerFocus: DoughnutSegmentKey = hoveredSegment ?? "at_risk";
  const centerShare = centerFocus === "on_track" ? onTrackShare : atRiskShare;
  const centerPercent = total > 0 ? `${Math.round(centerShare * 100)}%` : "—";
  const centerLabel = centerFocus === "on_track" ? "успевают" : "под риском";
  const centerValueClass =
    centerFocus === "on_track"
      ? `${styles.riskDoughnutCenterValue} ${styles.riskDoughnutCenterValueSuccess}`
      : `${styles.riskDoughnutCenterValue} ${styles.riskDoughnutCenterValueDanger}`;

  const renderSegment = (
    key: DoughnutSegmentKey,
    startShare: number,
    endShare: number,
    color: string,
    label: string,
    count: number
  ) => {
    if (count <= 0 || endShare <= startShare) return null;
    const isHovered = hoveredSegment === key;
    const isFullRing = endShare - startShare >= 0.999;
    return (
      <g
        key={key}
        className={styles.riskDoughnutSegment}
        onMouseEnter={() => setHoveredSegment(key)}
        onFocus={() => setHoveredSegment(key)}
        onClick={() => onSelectFilter?.(key)}
        role="button"
        tabIndex={0}
        aria-label={`${label}: ${count}`}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectFilter?.(key);
          }
        }}
      >
        {isFullRing ? (
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={isHovered ? hoverStroke : stroke}
            className={styles.riskDoughnutSegmentArc}
          />
        ) : (
          <path
            d={doughnutArcPath(centerX, centerY, radius, startShare, endShare)}
            fill="none"
            stroke={color}
            strokeWidth={isHovered ? hoverStroke : stroke}
            strokeLinecap="butt"
            className={styles.riskDoughnutSegmentArc}
          />
        )}
      </g>
    );
  };

  return (
    <figure className={styles.riskDoughnutFigure}>
      <div className={styles.riskDoughnutChartWrap}>
        <svg
          className={styles.riskDoughnutSvg}
          width={size}
          height={size}
          viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`}
          role="img"
          aria-labelledby="risk-doughnut-title risk-doughnut-desc"
          onMouseLeave={() => setHoveredSegment(null)}
        >
          <title id="risk-doughnut-title">Доля позиций под риском</title>
          <desc id="risk-doughnut-desc">
            {total > 0
              ? `Под риском ${atRisk} из ${total} позиций (${Math.round(atRiskShare * 100)}%). Успевают ${onTrack}.`
              : "Нет позиций в контрольных точках."}
          </desc>
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={stroke}
            pointerEvents="none"
          />
          {renderSegment(
            "on_track",
            0,
            onTrackShare,
            "var(--color-success)",
            "Успевают",
            onTrack
          )}
          {renderSegment(
            "at_risk",
            onTrackShare,
            1,
            "var(--color-danger)",
            "Под риском",
            atRisk
          )}
        </svg>
        <div className={styles.riskDoughnutCenterOverlay} aria-hidden="true">
          <strong className={centerValueClass}>{centerPercent}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <figcaption className={styles.riskDoughnutLegend}>
        <button
          type="button"
          className={`${styles.riskDoughnutLegendItem} ${
            hoveredSegment === "on_track" ? styles.riskDoughnutLegendItemActive : ""
          }`}
          onClick={() => onSelectFilter?.("on_track")}
          onMouseEnter={() => onTrack > 0 && setHoveredSegment("on_track")}
          onMouseLeave={() => setHoveredSegment(null)}
        >
          <span className={`${styles.riskDoughnutSwatch} ${styles.riskDoughnutSwatchSuccess}`} aria-hidden="true" />
          Успевают
          <strong>{onTrack}</strong>
        </button>
        <button
          type="button"
          className={`${styles.riskDoughnutLegendItem} ${
            hoveredSegment === "at_risk" ? styles.riskDoughnutLegendItemActive : ""
          }`}
          onClick={() => onSelectFilter?.("at_risk")}
          onMouseEnter={() => atRisk > 0 && setHoveredSegment("at_risk")}
          onMouseLeave={() => setHoveredSegment(null)}
        >
          <span className={`${styles.riskDoughnutSwatch} ${styles.riskDoughnutSwatchDanger}`} aria-hidden="true" />
          Под риском
          <strong>{atRisk}</strong>
        </button>
      </figcaption>
    </figure>
  );
}

const ROLE_LABELS: Record<string, string> = {
  shipment_schedule: "график получения комплектующих",
  production_schedule: "План производства",
  detailed_production_schedule: "План производства на месяц",
  stock: "остатки",
  specification: "спецификация",
  other: "другое"
};

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function createStagedId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function createStagedFile(file: File): StagedFile {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${createStagedId()}`,
    file,
    role: null,
    roleStatus: "pending"
  };
}

function stagedFilesFingerprint(files: StagedFile[]): string {
  return files
    .map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`)
    .sort()
    .join("|");
}

function downloadBase64Excel(base64: string, filename: string): void {
  downloadBlob(fileToBlob(base64), filename);
}

function fileToBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

function fileFromBase64(base64: string, filename: string): File {
  const blob = fileToBlob(base64);
  return new File([blob], filename, { type: blob.type, lastModified: Date.now() });
}

function createMergedShipmentFile(base64: string, filename: string, sourceCount: number): StagedFile {
  const file = fileFromBase64(base64, filename);
  return {
    id: `merged-shipment-${Date.now()}-${createStagedId()}`,
    file,
    role: "shipment_schedule",
    roleStatus: "ready",
    isMergedShipment: true,
    mergedSourceCount: sourceCount,
    mergeStatus: "done"
  };
}

function fileToBase64(file: File): Promise<string> {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary);
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Открыть Excel-файл таблицей в новой вкладке. */
async function openLocalFile(file: File): Promise<void> {
  await openWorkbookInNewTab(file);
}

function extractAnalyzeError(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.code === "ERR_CANCELED" || error.name === "CanceledError") {
      return "";
    }
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail.trim();
    }
    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: unknown }).msg);
          }
          return null;
        })
        .filter((item): item is string => Boolean(item));
      if (parts.length) return parts.join("; ");
    }
    if (error.response?.status === 422) {
      return "Не удалось определить роли загруженных файлов.";
    }
    if (error.response?.status === 401) {
      return "Сессия истекла. Войдите в систему снова.";
    }
    if (error.code === "ECONNABORTED" || /timeout/i.test(error.message)) {
      return "Сервер не успел ответить. Повторите распознавание файлов.";
    }
    if (!error.response) {
      return "Нет связи с сервером. Убедитесь, что backend запущен.";
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Не удалось выполнить анализ";
}

function isRequestCanceled(error: unknown): boolean {
  return isAxiosError(error) && (error.code === "ERR_CANCELED" || error.name === "CanceledError");
}

function formatAnalysisTimestamp(value?: string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
      .format(new Date())
      .replace(",", "");
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })
    .format(date)
    .replace(",", "");
}

export default function DocumentAnalysisAgent({ hideCatalogLink = false }: { hideCatalogLink?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dashboardRefreshWarning, setDashboardRefreshWarning] = useState<string | null>(null);
  const [isLoadingLatestDashboard, setIsLoadingLatestDashboard] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastSavedAnalysisAt, setLastSavedAnalysisAt] = useState<string | null>(null);
  const [sessionAnalysisAt, setSessionAnalysisAt] = useState<string | null>(null);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [logisticsRisks, setLogisticsRisks] = useState<{
    asOf: string | null;
    stages: LogisticsRiskStageView[];
  } | null>(null);
  const [shiftAssignment, setShiftAssignment] = useState<{
    fileName: string;
    fileBase64: string;
    values: string[][];
    rowPriorities: Array<"urgent" | "today" | "week" | null>;
    rowKinds: ShiftAssignmentRowKind[];
    meta: ShiftAssignmentMeta | null;
  } | null>(null);
  const [taskBoard, setTaskBoard] = useState<{
    values: string[][];
    rowPriorities: Array<"urgent" | "today" | "week" | null>;
    rowKinds: ShiftAssignmentRowKind[];
    meta: ShiftAssignmentMeta | null;
  } | null>(null);
  const [shiftDayExpired, setShiftDayExpired] = useState(false);
  const [shiftPreviousValidDate, setShiftPreviousValidDate] = useState<string | null>(null);
  const [scheduleFlipModalOpen, setScheduleFlipModalOpen] = useState(false);
  const [scheduleFlipModalFace, setScheduleFlipModalFace] = useState<ScheduleFlipFace>("shift");
  const [mergedShipmentSchedule, setMergedShipmentSchedule] = useState<{
    fileName: string;
    fileBase64: string;
    values: string[][];
    stats: MergedShipmentStats | null;
    sourceCount: number;
    changedCells: Array<{ row: number; col: number }>;
  } | null>(null);
  const [shiftResultTexts, setShiftResultTexts] = useState<Record<string, string>>({});
  const [shiftResultEvals, setShiftResultEvals] = useState<Record<string, ShiftResultEvalState>>({});
  const progressSkipSaveRef = useRef(true);
  const [scheduleDiff, setScheduleDiff] = useState<ScheduleComparisonNotice | null>(null);
  const [detailedDiff, setDetailedDiff] = useState<DetailedComparisonNotice | null>(null);
  const [schedulePruneNotice, setSchedulePruneNotice] = useState<string | null>(null);
  const [detailedPruneNotice, setDetailedPruneNotice] = useState<string | null>(null);
  const [russiaShipmentSource, setRussiaShipmentSource] = useState<RussiaShipmentSource | null>(null);
  const [russiaShipmentSourceLoading, setRussiaShipmentSourceLoading] = useState(false);
  const [russiaShipmentUploadLoading, setRussiaShipmentUploadLoading] = useState(false);
  const [shipmentSourceError, setShipmentSourceError] = useState<string | null>(null);
  const [shipmentManualChangeNotices, setShipmentManualChangeNotices] = useState<
    ShipmentManualChangeNotice[]
  >([]);
  const [selectedRiskStageKey, setSelectedRiskStageKey] = useState("");
  const [riskItemFilter, setRiskItemFilter] = useState<RiskItemFilter>("all");
  const [flippedRiskTile, setFlippedRiskTile] = useState<RiskItemFilter | null>(null);
  const [virtualRiskFilter, setVirtualRiskFilter] = useState<RiskItemFilter | null>(null);
  const [openSupplierKeys, setOpenSupplierKeys] = useState<Set<string>>(() => new Set());
  const [riskDashboardOpen, setRiskDashboardOpen] = useState(true);
  const [coverageDashboard, setCoverageDashboard] = useState<CoverageDashboardPayload | null>(
    null
  );
  const [managerCompletionDashboard, setManagerCompletionDashboard] =
    useState<ManagerCompletionDashboard | null>(null);
  const [managerReportDate, setManagerReportDate] = useState(() => todayMskIso());
  const [managerCompletionToday, setManagerCompletionToday] = useState(() => todayMskIso());
  const [managerCompletionDates, setManagerCompletionDates] = useState<ManagerCompletionDateEntry[]>(
    []
  );
  const [managerCompletionLoading, setManagerCompletionLoading] = useState(false);
  const [managerCompletionError, setManagerCompletionError] = useState<string | null>(null);
  const [executiveReportLoading, setExecutiveReportLoading] = useState(false);
  const [executiveReportError, setExecutiveReportError] = useState<string | null>(null);
  const [riskPointsOpen, setRiskPointsOpen] = useState(false);
  const riskStageContentRef = useRef<HTMLDivElement>(null);
  const lastRealStageKeyRef = useRef("");
  const [stagesCompact, setStagesCompact] = useState(false);
  const [stagesInlineHidden, setStagesInlineHidden] = useState(false);
  const [stagesOverlayOpen, setStagesOverlayOpen] = useState(false);
  const [rolesSource, setRolesSource] = useState<string | null>(null);
  const [isClassifyingRoles, setIsClassifyingRoles] = useState(false);
  const [isMergingShipments, setIsMergingShipments] = useState(false);
  const [mergedShipmentPreviewLoading, setMergedShipmentPreviewLoading] = useState(false);
  const [isPruningSchedules, setIsPruningSchedules] = useState(false);
  const [isPruningDetailedSchedules, setIsPruningDetailedSchedules] = useState(false);
  const [onecManualSyncLoading, setOnecManualSyncLoading] = useState(false);
  const [onecManualSyncResult, setOnecManualSyncResult] = useState<OnecManualSyncMessageView | null>(null);
  const [onecManualSyncProgress, setOnecManualSyncProgress] =
    useState<OnecSyncProgressView | null>(null);
  const [googleSheetsConfigured, setGoogleSheetsConfigured] = useState<boolean | null>(null);
  const [onecSyncRefreshToken, setOnecSyncRefreshToken] = useState(0);
  const {
    stock: onecStockStatus,
    specs: onecSpecsStatus,
    productionPlan: onecProductionPlanStatus,
    loading: onecSyncStatusLoading
  } = useTempOnecSyncStatus(onecSyncRefreshToken);
  const referenceCache = useAveonReferenceCache(onecSyncRefreshToken);
  const [mergeSourceNames, setMergeSourceNames] = useState<string[]>([]);
  const lastShipmentMergeKeyRef = useRef("");
  const mergedShipmentHydratedKeyRef = useRef("");
  const mergedShipmentPreviewInFlightRef = useRef(false);
  const appliedShipmentDateChangeRef = useRef<Set<string>>(new Set());
  const mergeInFlightRef = useRef(false);
  const lastSchedulePruneKeyRef = useRef("");
  const schedulePruneInFlightRef = useRef(false);
  const lastDetailedPruneKeyRef = useRef("");
  const detailedPruneInFlightRef = useRef(false);
  const russiaShipmentInputRef = useRef<HTMLInputElement>(null);
  const stagesSectionRef = useRef<HTMLDivElement>(null);
  const classifyRequestIdRef = useRef(0);
  const classifyAbortRef = useRef<AbortController | null>(null);
  const stagedFilesRef = useRef(stagedFiles);
  const filesFingerprintRef = useRef("");
  const isAnalyzingRef = useRef(false);
  stagedFilesRef.current = stagedFiles;
  isAnalyzingRef.current = isAnalyzing;
  const { user } = useAuth();
  const managerScope = useMemo(() => resolveShiftManagerScope(user), [user]);

  const refreshShipmentSources = useCallback(async () => {
    setRussiaShipmentSourceLoading(true);
    setShipmentSourceError(null);
    const [russiaResult, googleResult] = await Promise.allSettled([
      agentsApi.getCurrentRussiaShipmentSchedule(),
      agentsApi.getAveonGoogleSheetsStatus()
    ]);

    if (russiaResult.status === "fulfilled") {
      setRussiaShipmentSource(russiaResult.value.schedule);
    } else {
      setRussiaShipmentSource(null);
    }

    if (googleResult.status === "fulfilled") {
      setGoogleSheetsConfigured(Boolean(googleResult.value.configured));
    } else {
      setGoogleSheetsConfigured(null);
    }

    const errors: string[] = [];
    if (russiaResult.status === "rejected") {
      errors.push(
        extractAnalyzeError(russiaResult.reason) || "Не удалось проверить график России в БД"
      );
    } else if (!russiaResult.value.schedule) {
      errors.push("Российский график отгрузок не загружен в БД");
    }

    if (googleResult.status === "rejected") {
      errors.push(
        extractAnalyzeError(googleResult.reason) || "Не удалось проверить Google Sheets"
      );
    } else if (!googleResult.value.configured) {
      errors.push("Google Sheets для графика Китая не настроен");
    }

    setShipmentSourceError(errors.length ? errors.join(" · ") : null);
    setRussiaShipmentSourceLoading(false);
  }, []);

  useEffect(() => {
    void refreshShipmentSources();
  }, [refreshShipmentSources]);

  const visibleShiftAssignment = useMemo(() => {
    if (!shiftAssignment) return null;
    if (!managerScope) return shiftAssignment;
    return applyShiftManagerScopeToAssignment(shiftAssignment, managerScope);
  }, [shiftAssignment, managerScope]);

  const visibleTaskBoard = useMemo(() => {
    if (!taskBoard) return null;
    if (!managerScope) return null;
    return applyShiftManagerScopeToAssignment(taskBoard, managerScope);
  }, [taskBoard, managerScope]);

  const loadManagerCompletionDates = useCallback(async () => {
    try {
      const payload = await agentsApi.getShiftCompletionDates();
      setManagerCompletionDates(payload.dates);
      setManagerCompletionToday(payload.today || todayMskIso());
    } catch {
      setManagerCompletionDates([]);
    }
  }, []);

  const loadManagerCompletionDashboard = useCallback(async (reportDate: string) => {
    setManagerCompletionLoading(true);
    setManagerCompletionError(null);
    try {
      const dashboard = await agentsApi.getShiftCompletionDashboard({ reportDate });
      setManagerCompletionDashboard(dashboard);
    } catch {
      setManagerCompletionDashboard(null);
      setManagerCompletionError("Не удалось загрузить аналитику за выбранную дату.");
    } finally {
      setManagerCompletionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (managerScope) {
      setManagerCompletionDashboard(null);
      setManagerCompletionDates([]);
      setManagerCompletionError(null);
      setManagerCompletionLoading(false);
      return;
    }
    void loadManagerCompletionDates();
  }, [managerScope, loadManagerCompletionDates]);

  useEffect(() => {
    if (managerScope) return;
    void loadManagerCompletionDashboard(managerReportDate);
  }, [managerScope, managerReportDate, loadManagerCompletionDashboard]);

  useEffect(() => {
    if (managerScope) return;
    if (managerReportDate !== managerCompletionToday) return;
    if (!managerCompletionDashboard?.liveMode) return;

    const timer = window.setInterval(() => {
      void loadManagerCompletionDashboard(managerReportDate);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [
    managerScope,
    managerReportDate,
    managerCompletionToday,
    managerCompletionDashboard?.liveMode,
    loadManagerCompletionDashboard
  ]);

  const managerTasksNotice = useMemo(() => {
    if (!shiftDayExpired) return null;
    return {
      kind: "new_day" as const,
      previousValidDate: shiftPreviousValidDate,
      today: todayMskIso()
    };
  }, [shiftDayExpired, shiftPreviousValidDate]);

  const handleExecutiveReportDownload = useCallback(async (params: ExecutiveReportDownloadParams) => {
    if (managerScope) return;
    setExecutiveReportLoading(true);
    setExecutiveReportError(null);
    try {
      const report = await agentsApi.downloadExecutiveProcurementReport({
        periodMode: params.mode,
        reportDate: params.mode === "day" ? params.reportDate ?? managerReportDate : undefined,
        dateFrom: params.mode === "range" ? params.dateFrom : undefined,
        dateTo: params.mode === "range" ? params.dateTo : undefined
      });
      const filename =
        params.mode === "day"
          ? `aveon_executive_procurement_report_${params.reportDate ?? managerReportDate}.xlsx`
          : params.mode === "all"
            ? `aveon_executive_procurement_report_all.xlsx`
            : `aveon_executive_procurement_report_${params.dateFrom}_${params.dateTo}.xlsx`;
      downloadBlob(report, filename);
    } catch (caughtError) {
      setExecutiveReportError(
        extractAnalyzeError(caughtError) || "Не удалось сформировать сводный отчёт руководителя."
      );
    } finally {
      setExecutiveReportLoading(false);
    }
  }, [managerScope, managerReportDate]);

  const managerResultsBundle = useMemo<ManagerResultsBundle | null>(() => {
    if (managerScope) return null;
    return {
      dashboard: managerCompletionDashboard,
      selectedDate: managerReportDate,
      availableDates: managerCompletionDates,
      today: managerCompletionToday,
      loading: managerCompletionLoading,
      error: managerCompletionError,
      executiveReportLoading,
      executiveReportError,
      onDateChange: setManagerReportDate,
      onRetry: () => {
        void loadManagerCompletionDashboard(managerReportDate);
      },
      onRefresh: () => {
        void loadManagerCompletionDates();
        void loadManagerCompletionDashboard(managerReportDate);
      },
      onExecutiveReportDownload: handleExecutiveReportDownload
    };
  }, [
    managerScope,
    managerCompletionDashboard,
    managerReportDate,
    managerCompletionDates,
    managerCompletionToday,
    managerCompletionLoading,
    managerCompletionError,
    executiveReportLoading,
    executiveReportError,
    loadManagerCompletionDashboard,
    loadManagerCompletionDates,
    handleExecutiveReportDownload
  ]);

  const acceptedHint = useMemo(
    () => documentAnalysisAcceptedExtensions.map((ext) => ext.replace(".", "").toUpperCase()).join(", "),
    []
  );

  const filesFingerprint = useMemo(() => stagedFilesFingerprint(stagedFiles), [stagedFiles]);

  const presentRequiredRoles = useMemo(() => {
    const roles = new Set<string>();
    for (const item of stagedFiles) {
      if (item.roleStatus === "ready" && item.role) {
        roles.add(item.role);
      }
    }
    return roles;
  }, [stagedFiles]);

  const rolesSettled =
    stagedFiles.length > 0 &&
    !isClassifyingRoles &&
    stagedFiles.every((item) => item.roleStatus === "ready" || item.roleStatus === "error");

  const productionDbReady = Boolean(
    referenceCache.productionPlan?.ok &&
      (referenceCache.productionPlan?.year_schedule_view?.products_count ?? 0) > 0
  );
  const stockDbReady = Boolean((onecStockStatus?.db_count ?? 0) > 0);
  const specsDbReady = Boolean((onecSpecsStatus?.db_specs ?? 0) > 0);
  const productionPlanOnecReady = Boolean(
    (onecProductionPlanStatus?.db_count ?? 0) > 0 || productionDbReady
  );
  const dbSourcesReady =
    productionDbReady && Boolean(russiaShipmentSource) && googleSheetsConfigured !== false;
  const onecSourcesReady = stockDbReady && specsDbReady && productionPlanOnecReady;

  const missingRequiredRoles = useMemo(
    () =>
      requiredFileRoles.filter(
        (entry) => entry.required && !presentRequiredRoles.has(entry.role)
      ),
    [presentRequiredRoles]
  );

  const shipmentSourcesReady = Boolean(russiaShipmentSource) && googleSheetsConfigured !== false;

  const requiredFilesValid =
    rolesSettled &&
    !isMergingShipments &&
    !isPruningSchedules &&
    !isPruningDetailedSchedules &&
    shipmentSourcesReady &&
    dbSourcesReady &&
    onecSourcesReady &&
    missingRequiredRoles.length === 0;

  useEffect(() => {
    logAveonScheduleSnapshotStatus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    progressSkipSaveRef.current = true;
    setIsLoadingLatestDashboard(true);
    void agentsApi
      .getAveonDashboardLatest()
      .then((snapshot) => {
        if (cancelled || !snapshot) return;
        setLogisticsRisks(snapshot.logisticsRisks);
        setCoverageDashboard(parseCoverageDashboard(snapshot.coverageDashboard));
        setLastSavedAnalysisAt(formatAnalysisTimestamp(snapshot.analyzedAt));
        setShiftDayExpired(Boolean(snapshot.shiftDayExpired));
        setShiftPreviousValidDate(snapshot.shiftPreviousValidDate ?? null);
        const dashboardDate =
          snapshot.dashboardDateMsk ??
          (typeof snapshot.coverageDashboard === "object" &&
          snapshot.coverageDashboard &&
          "asOf" in snapshot.coverageDashboard
            ? String((snapshot.coverageDashboard as { asOf?: string }).asOf ?? "").slice(0, 10)
            : null) ??
          snapshot.logisticsRisks.asOf?.slice(0, 10) ??
          snapshot.analyzedAt.slice(0, 10);
        if (
          dashboardDate &&
          snapshot.shiftTodayMsk &&
          dashboardDate !== snapshot.shiftTodayMsk
        ) {
          const reason = snapshot.autoRefreshError ? ` Причина: ${snapshot.autoRefreshError}` : "";
          setDashboardRefreshWarning(
            `Не удалось обновить дашборды на сегодня, показан последний сохранённый анализ.${reason}`
          );
        } else if (
          snapshot.autoRefreshStatus === "missing_inputs" ||
          snapshot.autoRefreshStatus === "missing_detailed_schedule" ||
          snapshot.autoRefreshStatus === "error"
        ) {
          const reason = snapshot.autoRefreshError ? ` Причина: ${snapshot.autoRefreshError}` : "";
          setDashboardRefreshWarning(
            `Не удалось обновить дашборды на сегодня, показан последний сохранённый анализ.${reason}`
          );
        } else {
          setDashboardRefreshWarning(null);
        }

        if (snapshot.taskDashboard) {
          const board = {
            values: snapshot.taskDashboard.values,
            rowPriorities: snapshot.taskDashboard.rowPriorities,
            rowKinds: snapshot.taskDashboard.rowKinds,
            meta: snapshot.taskDashboard.meta
          };
          setTaskBoard(board);
          const savedTexts = snapshot.taskDashboard.resultTexts;
          const savedEvals = snapshot.taskDashboard.resultEvals;
          if (Object.keys(savedTexts).length > 0) {
            setShiftResultTexts(savedTexts);
          } else if (board.values.length > 0) {
            const header = board.values[0] ?? [];
            setShiftResultTexts(
              buildInitialResultTexts(
                board.values.slice(1),
                board.rowKinds.slice(1),
                buildColIndexByHeader(header)
              )
            );
          }
          setShiftResultEvals(savedEvals);
          setRiskDashboardOpen(true);
        } else {
          setTaskBoard(null);
          setShiftAssignment(null);
          setShiftResultTexts({});
          setShiftResultEvals({});
        }

        if (snapshot.shiftAssignment && snapshot.taskDashboard) {
          setShiftAssignment({
            fileName: snapshot.shiftAssignment.fileName,
            fileBase64: snapshot.shiftAssignment.fileBase64,
            values: snapshot.taskDashboard.values,
            rowPriorities: snapshot.taskDashboard.rowPriorities,
            rowKinds: snapshot.taskDashboard.rowKinds,
            meta: snapshot.taskDashboard.meta
          });
        }

        if (snapshot.mergedShipmentSchedule) {
          setMergedShipmentSchedule({
            fileName: snapshot.mergedShipmentSchedule.fileName,
            fileBase64: snapshot.mergedShipmentSchedule.fileBase64,
            values: snapshot.mergedShipmentSchedule.values,
            stats: snapshot.mergedShipmentSchedule.stats,
            sourceCount: snapshot.mergedShipmentSchedule.sourceCount,
            changedCells: snapshot.mergedShipmentSchedule.changedCells
          });
        }
      })
      .catch(() => {
        // нет сохранённого дашборда — обычный пустой старт
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingLatestDashboard(false);
        window.setTimeout(() => {
          progressSkipSaveRef.current = false;
        }, 1000);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!taskBoard?.values.length || progressSkipSaveRef.current) return;
    const timer = window.setTimeout(() => {
      void agentsApi
        .saveShiftAssignmentProgress({
          resultTexts: shiftResultTexts,
          resultEvals: shiftResultEvals
        })
        .catch(() => {
          // прогресс не критичен для UI
        });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [taskBoard, shiftResultTexts, shiftResultEvals]);

  const closeScheduleFlipModal = useCallback(() => {
    setScheduleFlipModalOpen(false);
  }, []);

  const exportVisibleShiftAssignment = useCallback(() => {
    if (!visibleShiftAssignment) return;
    downloadBase64Excel(visibleShiftAssignment.fileBase64, visibleShiftAssignment.fileName);
  }, [visibleShiftAssignment]);

  const exportMergedShipmentSchedule = useCallback(() => {
    if (!mergedShipmentSchedule) return;
    downloadBase64Excel(mergedShipmentSchedule.fileBase64, mergedShipmentSchedule.fileName);
  }, [mergedShipmentSchedule]);

  const persistMergedShipmentSchedule = useCallback(
    async (schedule: {
      fileName: string;
      fileBase64: string;
      values: string[][];
      stats: MergedShipmentStats | null;
      sourceCount: number;
      changedCells?: Array<{ row: number; col: number }>;
    }) => {
      const nextSchedule = {
        ...schedule,
        changedCells: schedule.changedCells ?? []
      };
      setMergedShipmentSchedule(nextSchedule);
      try {
        await agentsApi.saveMergedShipmentSnapshot({
          fileName: nextSchedule.fileName,
          fileBase64: nextSchedule.fileBase64,
          previewValues: nextSchedule.values,
          stats: nextSchedule.stats,
          sourceCount: nextSchedule.sourceCount,
          changedCells: nextSchedule.changedCells
        });
      } catch (caughtError) {
        console.warn("Не удалось сохранить график отгрузок в snapshot:", caughtError);
      }
    },
    []
  );

  const ensureMergedShipmentPreview = useCallback(async () => {
    if (mergedShipmentPreviewInFlightRef.current) return;
    if ((mergedShipmentSchedule?.values?.length ?? 0) > 1) return;

    const mergedItem = stagedFilesRef.current.find(
      (item) => item.role === "shipment_schedule" && item.isMergedShipment
    );
    if (!mergedItem) return;

    mergedShipmentPreviewInFlightRef.current = true;
    setMergedShipmentPreviewLoading(true);
    try {
      const previewPromise = agentsApi.previewShipmentSchedule(mergedItem.file);
      const base64Promise = mergedShipmentSchedule?.fileBase64
        ? Promise.resolve(mergedShipmentSchedule.fileBase64)
        : fileToBase64(mergedItem.file);
      const [preview, fileBase64] = await Promise.all([previewPromise, base64Promise]);
      void persistMergedShipmentSchedule({
        fileName: preview.file_name || mergedItem.file.name,
        fileBase64,
        values: preview.preview_values ?? [],
        stats: mergedShipmentSchedule?.stats ?? {
          nomenclature_total: Math.max((preview.preview_values ?? []).length - 1, 0)
        },
        sourceCount: mergedItem.mergedSourceCount ?? mergedShipmentSchedule?.sourceCount ?? 0,
        changedCells: mergedShipmentSchedule?.changedCells ?? []
      });
    } catch (caughtError) {
      console.error("Не удалось загрузить preview графика отгрузок:", caughtError);
    } finally {
      mergedShipmentPreviewInFlightRef.current = false;
      setMergedShipmentPreviewLoading(false);
    }
  }, [mergedShipmentSchedule, persistMergedShipmentSchedule]);

  const openScheduleFlipModal = useCallback(
    (face: ScheduleFlipFace) => {
      setScheduleFlipModalFace(face);
      setScheduleFlipModalOpen(true);
      if (face === "shipment") {
        void ensureMergedShipmentPreview();
      }
    },
    [ensureMergedShipmentPreview]
  );

  const pushShipmentManualNotice = useCallback(
    (notice: Omit<ShipmentManualChangeNotice, "id">) => {
      const message = notice.message.trim();
      if (!message) return;
      setShipmentManualChangeNotices((current) => {
        const exists = current.some(
          (item) =>
            item.message === message &&
            (item.nomenclature || "") === (notice.nomenclature || "")
        );
        if (exists) return current;
        return [
          {
            ...notice,
            message,
            id: `${Date.now()}-${current.length}`,
          },
          ...current,
        ].slice(0, 8);
      });
    },
    []
  );

  const handleManagerResultEvaluated = useCallback(
    async (
      context: { taskType: string; problem: string; solution: string; nomenclature: string },
      managerResult: string,
      taskKey?: string
    ) => {
      if (!mergedShipmentSchedule?.fileBase64) return;
      const changeKey = [
        context.taskType,
        context.nomenclature,
        context.problem.slice(0, 120),
        managerResult
      ].join("::");
      if (appliedShipmentDateChangeRef.current.has(changeKey)) return;
      try {
        const response = await agentsApi.applyShipmentManagerDateChange({
          fileName: mergedShipmentSchedule.fileName,
          fileBase64: mergedShipmentSchedule.fileBase64,
          taskType: context.taskType,
          problem: context.problem,
          solution: context.solution,
          nomenclature: context.nomenclature,
          managerResult,
          taskKey: taskKey ?? changeKey,
          managerName: user?.full_name || user?.email || null
        });
        if (response.manual_action_required) {
          pushShipmentManualNotice({
            message: response.message,
            nomenclature: response.change?.nomenclature ?? context.nomenclature,
            country: response.country,
            changedCells: response.changed_cells ?? []
          });
        }
        if (!response.applied || !response.file_base64 || !response.preview_values) {
          console.info("[Aveon] дата графика отгрузок не изменена:", response.message);
          return;
        }
        const nextSchedule = {
          fileName: response.file_name || mergedShipmentSchedule.fileName,
          fileBase64: response.file_base64,
          values: response.preview_values,
          stats: mergedShipmentSchedule.stats,
          sourceCount: mergedShipmentSchedule.sourceCount,
          changedCells: [
            ...(mergedShipmentSchedule.changedCells ?? []),
            ...(response.changed_cells ?? [])
          ]
        };
        if (response.manual_action_required) {
          setMergedShipmentSchedule(nextSchedule);
        } else {
          await persistMergedShipmentSchedule(nextSchedule);
        }
        const nextFileName = response.file_name || mergedShipmentSchedule.fileName;
        const nextFile = fileFromBase64(response.file_base64, nextFileName);
        mergedShipmentHydratedKeyRef.current = `${nextFile.name}:${nextFile.size}:${nextFile.lastModified}`;
        setStagedFiles((current) =>
          current.map((item) =>
            item.role === "shipment_schedule" && item.isMergedShipment
              ? {
                  ...item,
                  file: nextFile,
                  mergedSourceCount: item.mergedSourceCount ?? mergedShipmentSchedule.sourceCount
                }
              : item
          )
        );
        appliedShipmentDateChangeRef.current.add(changeKey);
        setScheduleFlipModalFace("shipment");
      } catch (caughtError) {
        console.warn("Не удалось применить изменение даты в графике отгрузок:", caughtError);
      }
    },
    [
      mergedShipmentSchedule,
      persistMergedShipmentSchedule,
      pushShipmentManualNotice,
      user?.email,
      user?.full_name,
    ]
  );

  const scheduleFlipShiftProps = useMemo(
    () =>
      visibleShiftAssignment
        ? {
            loading: false,
            error: null,
            values: visibleShiftAssignment.values,
            rowPriorities: visibleShiftAssignment.rowPriorities,
            rowKinds: visibleShiftAssignment.rowKinds,
            meta: visibleShiftAssignment.meta,
            fileName: visibleShiftAssignment.fileName,
            resultTexts: shiftResultTexts,
            onResultTextsChange: setShiftResultTexts,
            resultEvals: shiftResultEvals,
            onResultEvalsChange: setShiftResultEvals,
            onManagerResultEvaluated: handleManagerResultEvaluated,
            manualShipmentNotices: shipmentManualChangeNotices,
            onExport: exportVisibleShiftAssignment,
          }
        : null,
    [
      visibleShiftAssignment,
      shiftResultTexts,
      shiftResultEvals,
      handleManagerResultEvaluated,
      shipmentManualChangeNotices,
      exportVisibleShiftAssignment,
    ]
  );

  const stagedMergedShipment = useMemo(
    () => stagedFiles.find((item) => item.role === "shipment_schedule" && item.isMergedShipment),
    [stagedFiles]
  );

  const shipmentScheduleAvailable = Boolean(
    mergedShipmentSchedule || stagedMergedShipment || isMergingShipments
  );

  const scheduleFlipShipmentProps = useMemo(
    () => {
      if (!shipmentScheduleAvailable) return null;

      const schedule = mergedShipmentSchedule;
      const hasPreviewRows = (schedule?.values?.length ?? 0) > 1;

      return {
        loading: isMergingShipments || mergedShipmentPreviewLoading || !hasPreviewRows,
        error: null,
        values: schedule?.values ?? [],
        fileName: schedule?.fileName ?? stagedMergedShipment?.file.name ?? "merged_shipment.xlsx",
        fileBase64: schedule?.fileBase64 ?? "",
        stats: schedule?.stats ?? null,
        sourceCount: schedule?.sourceCount ?? stagedMergedShipment?.mergedSourceCount,
        changedCells: schedule?.changedCells ?? [],
        onExport: exportMergedShipmentSchedule
      };
    },
    [
      shipmentScheduleAvailable,
      mergedShipmentSchedule,
      stagedMergedShipment,
      isMergingShipments,
      mergedShipmentPreviewLoading,
      exportMergedShipmentSchedule
    ]
  );

  useEffect(() => {
    if (!onecManualSyncLoading) return;

    let cancelled = false;
    const refreshProgress = async () => {
      try {
        const result = await agentsApi.getAveonOnecSyncProgress();
        if (!cancelled) {
          setOnecManualSyncProgress(result.progress ?? null);
        }
      } catch {
        // Прогресс вспомогательный: основной POST всё равно вернёт итог синхронизации.
      }
    };

    void refreshProgress();
    const timer = window.setInterval(() => void refreshProgress(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [onecManualSyncLoading]);

  const handleOnecManualSync = useCallback(async () => {
    setOnecManualSyncLoading(true);
    setOnecManualSyncResult(null);
    setOnecManualSyncProgress({
      running: true,
      started_at: new Date().toISOString(),
      step: "connect",
      label: "Подключаемся к 1С и готовим выгрузку",
      steps: [
        { key: "stock", title: "Остатки", status: "pending" },
        { key: "resource_specs", title: "Спецификации", status: "pending" },
        { key: "production_plan", title: "План производства", status: "pending" },
        { key: "save_plan", title: "Запись в БД", status: "pending" },
      ],
    });
    try {
      const result = await agentsApi.runAveonOnecSyncNow();
      setOnecManualSyncResult(parseOnecManualSyncMessage(result));
      setOnecSyncRefreshToken((value) => value + 1);
    } catch (caughtError) {
      console.error("[Aveon 1С] ошибка ручной выгрузки", caughtError);
      setOnecManualSyncResult({
        tone: "error",
        title: sanitizeOnecErrorMessage(extractAnalyzeError(caughtError) || "Ошибка выгрузки из 1С."),
        steps: [],
      });
    } finally {
      setOnecManualSyncLoading(false);
      setOnecManualSyncProgress(null);
    }
  }, []);

  const handleRussiaShipmentUpload = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    setRussiaShipmentUploadLoading(true);
    setShipmentSourceError(null);
    try {
      const result = await agentsApi.uploadRussiaShipmentSchedule(file);
      setRussiaShipmentSource(result.schedule);
      setMergedShipmentSchedule(null);
      setShipmentManualChangeNotices([]);
      await refreshShipmentSources();
    } catch (caughtError) {
      setShipmentSourceError(extractAnalyzeError(caughtError) || "Не удалось загрузить российский график");
    } finally {
      setRussiaShipmentUploadLoading(false);
      if (russiaShipmentInputRef.current) {
        russiaShipmentInputRef.current.value = "";
      }
    }
  }, [refreshShipmentSources]);

  const addFiles = useCallback((files: FileList | File[]) => {
    if (isAnalyzingRef.current) return;
    const incoming = Array.from(files);
    if (!incoming.length) return;

    const accepted: StagedFile[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      if (isAcceptedAnalysisFile(file)) {
        accepted.push(createStagedFile(file));
      } else {
        rejected.push(file.name);
      }
    }

    if (accepted.length) {
      setStagedFiles((current) => {
        const existingKeys = new Set(current.map((item) => `${item.file.name}:${item.file.size}`));
        const next = [...current];
        for (const item of accepted) {
          const key = `${item.file.name}:${item.file.size}`;
          if (!existingKeys.has(key)) {
            existingKeys.add(key);
            next.push(item);
          }
        }
        return next;
      });
      setError(null);
    }

    if (rejected.length) {
      setError(`Неподдерживаемый формат: ${rejected.slice(0, 3).join(", ")}${rejected.length > 3 ? "…" : ""}`);
      return;
    }

    setError(null);
  }, []);

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragOver(false);
      if (event.dataTransfer.files?.length) {
        addFiles(event.dataTransfer.files);
      }
    },
    [addFiles]
  );

  useEffect(() => {
    const previousFingerprint = filesFingerprintRef.current;
    filesFingerprintRef.current = filesFingerprint;

    if (!filesFingerprint) {
      classifyAbortRef.current?.abort();
      classifyAbortRef.current = null;
      setRolesSource(null);
      setIsClassifyingRoles(false);
      return;
    }

    // Новые/изменённые файлы → чеклист ролей; дашборд прошлого анализа оставляем до нового прогона
    if (
      previousFingerprint &&
      previousFingerprint !== filesFingerprint &&
      !isAnalyzingRef.current
    ) {
      setStagesCompact(false);
      setStagesInlineHidden(false);
      setStagesOverlayOpen(false);
      setError(null);
      setScheduleDiff(null);
      setDetailedDiff(null);
      setSchedulePruneNotice(null);
      setDetailedPruneNotice(null);
    }

    // Во время полного анализа не дергаем classify — иначе гонка запросов и ложный «нет связи».
    if (isAnalyzingRef.current) {
      return;
    }

    const requestId = ++classifyRequestIdRef.current;
    classifyAbortRef.current?.abort();
    const abortController = new AbortController();
    classifyAbortRef.current = abortController;

    const timer = window.setTimeout(async () => {
      const filesSnapshot = stagedFilesRef.current.map((item) => item.file);
      if (!filesSnapshot.length || isAnalyzingRef.current) return;

      setIsClassifyingRoles(true);
      setStagedFiles((current) =>
        current.map((item) => ({
          ...item,
          roleStatus: "loading" as const
        }))
      );

      const runClassify = () =>
        agentsApi.classifyAveonExcel(filesSnapshot, { signal: abortController.signal });

      try {
        let result: Awaited<ReturnType<typeof agentsApi.classifyAveonExcel>>;
        try {
          result = await runClassify();
        } catch (firstError) {
          if (isRequestCanceled(firstError) || abortController.signal.aborted) {
            return;
          }
          // Один повтор при обрыве связи после длинного analyze (proxy/keep-alive).
          const canRetry =
            isAxiosError(firstError) &&
            !firstError.response &&
            firstError.code !== "ERR_CANCELED";
          if (!canRetry) throw firstError;
          await new Promise((resolve) => window.setTimeout(resolve, 400));
          if (requestId !== classifyRequestIdRef.current || abortController.signal.aborted) {
            return;
          }
          result = await runClassify();
        }

        if (requestId !== classifyRequestIdRef.current || abortController.signal.aborted) {
          return;
        }

        const roleByName = new Map(result.roles.map((entry) => [entry.filename, entry.role]));
        setRolesSource(result.source);
        setError(null);
        setStagedFiles((current) =>
          current.map((item) => ({
            ...item,
            role: roleByName.get(item.file.name) ?? null,
            roleStatus: roleByName.has(item.file.name) ? ("ready" as const) : ("error" as const)
          }))
        );
      } catch (caughtError) {
        if (
          requestId !== classifyRequestIdRef.current ||
          abortController.signal.aborted ||
          isRequestCanceled(caughtError)
        ) {
          return;
        }
        setRolesSource(null);
        const message = extractAnalyzeError(caughtError);
        if (message) setError(message);
        setStagedFiles((current) =>
          current.map((item) => ({
            ...item,
            roleStatus: "error" as const
          }))
        );
      } finally {
        if (requestId === classifyRequestIdRef.current) {
          setIsClassifyingRoles(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      abortController.abort();
      if (classifyAbortRef.current === abortController) {
        classifyAbortRef.current = null;
      }
      classifyRequestIdRef.current += 1;
    };
  }, [filesFingerprint]);

  useEffect(() => {
    if (!rolesSettled || isClassifyingRoles || isAnalyzingRef.current) {
      return;
    }

    const shipmentItems = stagedFilesRef.current.filter(
      (item) => item.role === "shipment_schedule" && !item.isMergedShipment
    );
    if (shipmentItems.length < 1) {
      lastShipmentMergeKeyRef.current = "";
      return;
    }

    const mergeKey = shipmentItems
      .map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`)
      .sort()
      .join("|");
    if (lastShipmentMergeKeyRef.current === mergeKey || mergeInFlightRef.current) {
      return;
    }
    lastShipmentMergeKeyRef.current = mergeKey;
    mergeInFlightRef.current = true;

    const sourceNames = shipmentItems.map((item) => item.file.name);
    setMergeSourceNames(sourceNames);
    setIsMergingShipments(true);
    setStagedFiles((current) =>
      current.map((item) =>
        item.role === "shipment_schedule" && !item.isMergedShipment
          ? { ...item, mergeStatus: "merging" as const }
          : item
      )
    );

    void (async () => {
      try {
        const result = await agentsApi.mergeShipmentSchedules(
          shipmentItems.map((item) => item.file),
          { includeGoogleSheets: false }
        );
        if (!result.ok || !result.file_base64 || !result.file_name) {
          throw new Error(result.message || "Не удалось объединить графики отгрузок");
        }
        const merged = createMergedShipmentFile(
          result.file_base64,
          result.file_name,
          shipmentItems.length
        );
        let previewValues = result.preview_values ?? [];
        if (!previewValues.length) {
          try {
            const preview = await agentsApi.previewShipmentSchedule(merged.file);
            previewValues = preview.preview_values ?? [];
          } catch (previewError) {
            console.warn("Preview графика отгрузок через API:", previewError);
          }
        }
        mergedShipmentHydratedKeyRef.current = `${merged.file.name}:${merged.file.size}:${merged.file.lastModified}`;
        setStagedFiles((current) => [
          ...current.filter((item) => item.role !== "shipment_schedule" || item.isMergedShipment),
          merged
        ]);
        void persistMergedShipmentSchedule({
          fileName: result.file_name,
          fileBase64: result.file_base64,
          values: previewValues,
          stats: (result.stats as MergedShipmentStats | undefined) ?? null,
          sourceCount: shipmentItems.length
        });
        setError(null);
      } catch (caughtError) {
        console.error("Ошибка объединения графиков отгрузок:", caughtError);
        const message = extractAnalyzeError(caughtError);
        if (message) setError(message);
        lastShipmentMergeKeyRef.current = "";
        setStagedFiles((current) =>
          current.map((item) =>
            item.mergeStatus === "merging" ? { ...item, mergeStatus: undefined } : item
          )
        );
      } finally {
        mergeInFlightRef.current = false;
        setIsMergingShipments(false);
        setMergeSourceNames([]);
      }
    })();
  }, [rolesSettled, isClassifyingRoles, filesFingerprint, persistMergedShipmentSchedule]);

  useEffect(() => {
    if (!rolesSettled || isClassifyingRoles || isAnalyzingRef.current) {
      return;
    }

    const mergedItem = stagedFilesRef.current.find(
      (item) => item.role === "shipment_schedule" && item.isMergedShipment
    );
    if (!mergedItem) {
      mergedShipmentHydratedKeyRef.current = "";
      return;
    }

    const hydrateKey = `${mergedItem.file.name}:${mergedItem.file.size}:${mergedItem.file.lastModified}`;
    if (mergedShipmentHydratedKeyRef.current === hydrateKey) {
      return;
    }
    if ((mergedShipmentSchedule?.values?.length ?? 0) > 1) {
      mergedShipmentHydratedKeyRef.current = hydrateKey;
      return;
    }
    mergedShipmentHydratedKeyRef.current = hydrateKey;

    void (async () => {
      try {
        const [fileBase64, preview] = await Promise.all([
          fileToBase64(mergedItem.file),
          agentsApi.previewShipmentSchedule(mergedItem.file)
        ]);
        void persistMergedShipmentSchedule({
          fileName: preview.file_name || mergedItem.file.name,
          fileBase64,
          values: preview.preview_values ?? [],
          stats: {
            nomenclature_total: Math.max((preview.preview_values ?? []).length - 1, 0)
          },
          sourceCount: mergedItem.mergedSourceCount ?? 0
        });
      } catch (caughtError) {
        console.error("Не удалось подтянуть объединённый график отгрузок:", caughtError);
        mergedShipmentHydratedKeyRef.current = "";
      }
    })();
  }, [
    rolesSettled,
    isClassifyingRoles,
    filesFingerprint,
    mergedShipmentSchedule?.values?.length,
    persistMergedShipmentSchedule
  ]);

  useEffect(() => {
    if (!rolesSettled || isClassifyingRoles || isAnalyzingRef.current) {
      return;
    }

    const scheduleItems = stagedFilesRef.current.filter(
      (item) => item.role === "production_schedule"
    );
    if (scheduleItems.length <= 1) {
      lastSchedulePruneKeyRef.current = "";
      setSchedulePruneNotice(null);
      return;
    }

    const pruneKey = scheduleItems
      .map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`)
      .sort()
      .join("|");
    if (lastSchedulePruneKeyRef.current === pruneKey || schedulePruneInFlightRef.current) {
      return;
    }
    lastSchedulePruneKeyRef.current = pruneKey;
    schedulePruneInFlightRef.current = true;
    setIsPruningSchedules(true);

    void (async () => {
      try {
        const result = await agentsApi.pruneProductionSchedules(
          scheduleItems.map((item) => item.file)
        );
        const removedNames = new Set((result.removed ?? []).map((item) => item.filename));
        if (removedNames.size > 0) {
          setStagedFiles((current) =>
            current.filter(
              (item) =>
                item.role !== "production_schedule" || !removedNames.has(item.file.name)
            )
          );
          setSchedulePruneNotice(
            result.message || "Оставлена последняя версия; сравнение — с сохранённой в системе"
          );
        } else {
          setSchedulePruneNotice(result.message || null);
        }
      } catch (caughtError) {
        console.error("Ошибка отбора версий графика производства:", caughtError);
        const message = extractAnalyzeError(caughtError);
        if (message) setError(message);
        lastSchedulePruneKeyRef.current = "";
      } finally {
        schedulePruneInFlightRef.current = false;
        setIsPruningSchedules(false);
      }
    })();
  }, [rolesSettled, isClassifyingRoles, filesFingerprint]);

  useEffect(() => {
    if (!rolesSettled || isClassifyingRoles || isAnalyzingRef.current) {
      return;
    }

    const detailedItems = stagedFilesRef.current.filter(
      (item) => item.role === "detailed_production_schedule"
    );
    if (detailedItems.length <= 1) {
      lastDetailedPruneKeyRef.current = "";
      setDetailedPruneNotice(null);
      return;
    }

    const pruneKey = detailedItems
      .map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`)
      .sort()
      .join("|");
    if (lastDetailedPruneKeyRef.current === pruneKey || detailedPruneInFlightRef.current) {
      return;
    }
    lastDetailedPruneKeyRef.current = pruneKey;
    detailedPruneInFlightRef.current = true;
    setIsPruningDetailedSchedules(true);

    void (async () => {
      try {
        const result = await agentsApi.pruneDetailedSchedules(
          detailedItems.map((item) => item.file)
        );
        const removedNames = new Set((result.removed ?? []).map((item) => item.filename));
        if (removedNames.size > 0) {
          setStagedFiles((current) =>
            current.filter(
              (item) =>
                item.role !== "detailed_production_schedule" ||
                !removedNames.has(item.file.name)
            )
          );
          setDetailedPruneNotice(
            result.message || "Оставлена последняя версия; сравнение — с сохранённой в системе"
          );
        } else {
          setDetailedPruneNotice(result.message || null);
        }
      } catch (caughtError) {
        console.error("Ошибка отбора версий детального графика:", caughtError);
        const message = extractAnalyzeError(caughtError);
        if (message) setError(message);
        lastDetailedPruneKeyRef.current = "";
      } finally {
        detailedPruneInFlightRef.current = false;
        setIsPruningDetailedSchedules(false);
      }
    })();
  }, [rolesSettled, isClassifyingRoles, filesFingerprint]);

  const handleAnalyze = useCallback(async () => {
    if (!stagedFiles.length || isAnalyzing || !requiredFilesValid) return;

    classifyAbortRef.current?.abort();
    classifyAbortRef.current = null;
    classifyRequestIdRef.current += 1;
    setIsClassifyingRoles(false);

    setIsAnalyzing(true);
    setSessionAnalysisAt(null);
    setError(null);
    setDashboardRefreshWarning(null);
    setScheduleDiff(null);
    setDetailedDiff(null);
    setShiftAssignment(null);
    setTaskBoard(null);
    setScheduleFlipModalOpen(false);
    setShiftResultTexts({});
    setShiftResultEvals({});
    progressSkipSaveRef.current = true;
    setActiveStageIndex(0);
    setStagesCompact(false);
    setStagesInlineHidden(false);
    setStagesOverlayOpen(false);
    // предыдущий дашборд остаётся на экране до прихода нового результата
    const stageTimer = window.setInterval(() => {
      setActiveStageIndex((current) => Math.min(current + 1, analysisStages.length - 1));
    }, 1200);

    try {
      console.clear();
      console.log("[Анализ] Запуск…");
      if (stagedFiles.length) {
        console.log("Загруженные файлы:");
        stagedFiles.forEach((item, index) => {
          const roleLabel = item.role ? (ROLE_LABELS[item.role] ?? item.role) : "роль не определена";
          console.log(`  ${index + 1}. ${item.file.name} → ${roleLabel}`);
        });
      }

      const analysisFiles = stagedFiles.map((item) => item.file);
      const result = await agentsApi.analyzeAveonExcel(analysisFiles);

      window.clearInterval(stageTimer);
      setActiveStageIndex(analysisStages.length - 1);
      logAnalysisInputSources(result.inputSources, stagedFiles);
      if (result.mergedShipmentSchedule) {
        setMergedShipmentSchedule({
          ...result.mergedShipmentSchedule,
          stats: result.mergedShipmentSchedule.stats as MergedShipmentStats | null
        });
      }
      console.log("Определение ролей файлов — источник:", result.source);
      console.log("Роли файлов:");
      result.roles.forEach((item, index) => {
        const label = ROLE_LABELS[item.role] ?? item.role;
        console.log(`${index + 1}. ${item.filename} → ${label} (${item.role})`);
      });
      console.log("===========");
      const scheduleFilesLabel =
        result.productionScheduleFiles.length > 0
          ? result.productionScheduleFiles.join(", ")
          : "(график производства не найден)";
      console.log("Файл графика производства:", scheduleFilesLabel);
      console.log("Изделия из графика производства (план по месяцам):");
      if (result.productionSchedulePlans.length) {
        result.productionSchedulePlans.forEach((plan, index) => {
          const months = Object.entries(plan.monthly_qty)
            .map(([month, qty]) => `${month}: ${qty}`)
            .join("; ");
          console.log(`${index + 1}. ${plan.product}`);
          console.log(`   ${months || "(нет месячных значений)"}`);
        });
      } else if (result.productionScheduleProducts.length) {
        result.productionScheduleProducts.forEach((name, index) => {
          console.log(`${index + 1}. ${name}`);
        });
      } else {
        console.log("(изделия не найдены)");
      }
      console.log("===========");
      console.log("Сопоставление со спецификациями:");
      if (result.productSpecLinks.length) {
        result.productSpecLinks.forEach((link, index) => {
          if (link.status === "matched") {
            console.log(
              `${index + 1}. ${link.schedule_product} → ${link.nomenclature} → лист «${link.spec_sheet}»`
            );
          } else {
            console.log(
              `${index + 1}. ${link.schedule_product} → [${link.status}] ${link.reason || "не сопоставлено"}`
            );
          }
        });
      } else {
        console.log("(сопоставления нет)");
      }
      console.log("===========");
      console.log(
        `Материалы спецификаций: ${result.materialUsagesCount} позиций → ${result.mergedNomenclaturesCount} уникальных номенклатур`
      );
      console.log(
        `Цены и поставщики: найдено для ${result.priceMatchedCount} из ${result.mergedNomenclaturesCount}`
      );
      const stockFilesLabel =
        result.stockFiles.length > 0 ? result.stockFiles.join(", ") : "(остатки из БД 1С не найдены)";
      console.log(`Файл остатков: ${stockFilesLabel}`);
      console.log(
        `Остатки: найдено для ${result.stockMatchedCount} из ${result.mergedNomenclaturesCount}`
      );
      const shipmentFilesLabel =
        result.shipmentFiles.length > 0
          ? result.shipmentFiles.join(", ")
          : "(график отгрузок не найден)";
      console.log(`Файл графика отгрузок: ${shipmentFilesLabel}`);
      console.log(
        `Ожидаемые поступления: ненулевые для ${result.receiptsNonzeroCount} из ${result.mergedNomenclaturesCount}`
      );
      console.log(
        `Прогнозируемый остаток: дефицит (< 0) у ${result.forecastDeficitCount} из ${result.mergedNomenclaturesCount}`
      );
      console.log("===========");
      console.log(
        `Риски логистики на ${result.logisticsRisks.asOf ?? "—"}:`,
        result.logisticsRisks.stages.map((stage) => `${stage.label}: ${stage.items.length}`).join("; ")
      );
      result.logisticsRisks.stages.forEach((stage) => {
        if (!stage.items.length) return;
        console.log(`— ${stage.label}`);
        stage.items.forEach((item, index) => {
          console.log(
            `  ${index + 1}. ${item.nomenclature} | ${item.supplier ?? "без поставщика"} | qty ${item.quantity} | МСК ${item.moscowDate} | ${item.daysRemaining}д | ${item.riskLevel} | лист ${item.sheet}`
          );
        });
      });
      if (result.fileBase64) {
        downloadBase64Excel(result.fileBase64, result.fileName);
        console.log(`Скачан файл: ${result.fileName}`);
      } else {
        console.log("result.xlsx не сформирован");
      }
      if (result.shiftAssignmentValues?.length) {
        const board = {
          values: result.shiftAssignmentValues,
          rowPriorities: result.shiftAssignmentRowPriorities ?? [],
          rowKinds: result.shiftAssignmentRowKinds ?? [],
          meta: result.shiftAssignmentMeta
        };
        setShiftDayExpired(false);
        setShiftPreviousValidDate(null);
        setTaskBoard(board);
        const header = board.values[0] ?? [];
        setShiftResultTexts(
          buildInitialResultTexts(
            board.values.slice(1),
            board.rowKinds.slice(1),
            buildColIndexByHeader(header)
          )
        );
        setShiftResultEvals({});
        progressSkipSaveRef.current = false;
      } else {
        setTaskBoard(null);
        setShiftResultTexts({});
        setShiftResultEvals({});
      }
      if (result.shiftAssignmentFileBase64) {
        setShiftAssignment({
          fileName: result.shiftAssignmentFileName,
          fileBase64: result.shiftAssignmentFileBase64,
          values: result.shiftAssignmentValues ?? [],
          rowPriorities: result.shiftAssignmentRowPriorities ?? [],
          rowKinds: result.shiftAssignmentRowKinds ?? [],
          meta: result.shiftAssignmentMeta
        });
        setScheduleFlipModalOpen(false);
        console.log(
          `Сменное задание готово (просмотр по кнопке): ${result.shiftAssignmentFileName}`
        );
      } else {
        setShiftAssignment(null);
        setScheduleFlipModalOpen(false);
        console.log("сменное задание не сформировано");
      }

      if (result.scheduleBaselineSaved) {
        setScheduleDiff({
          kind: "baseline",
          fileName: result.scheduleDiffFileName,
          fileBase64: "",
          months: [],
          message: result.scheduleDiffMessage,
          oldVersion: result.scheduleDiffOldVersion,
          newVersion: result.scheduleDiffNewVersion,
          cells: 0
        });
      } else if (result.scheduleComparedWithSaved) {
        setScheduleDiff({
          kind: result.scheduleDiffHasChanges ? "changed" : "unchanged",
          fileName: result.scheduleDiffFileName,
          fileBase64: result.scheduleDiffFileBase64 ?? "",
          months: result.scheduleDiffChangedMonths,
          message: result.scheduleDiffMessage,
          oldVersion: result.scheduleDiffOldVersion,
          newVersion: result.scheduleDiffNewVersion,
          cells: result.scheduleDiffChangedCells
        });
      } else {
        setScheduleDiff(null);
      }

      if (result.detailedBaselineSaved) {
        setDetailedDiff({
          kind: "baseline",
          fileName: result.detailedDiffFileName,
          fileBase64: "",
          dates: [],
          message: result.detailedDiffMessage,
          oldVersion: result.detailedDiffOldVersion,
          newVersion: result.detailedDiffNewVersion,
          cells: 0
        });
      } else if (result.detailedComparedWithSaved) {
        setDetailedDiff({
          kind: result.detailedDiffHasChanges ? "changed" : "unchanged",
          fileName: result.detailedDiffFileName,
          fileBase64: result.detailedDiffFileBase64 ?? "",
          dates: result.detailedDiffChangedDates,
          message: result.detailedDiffMessage,
          oldVersion: result.detailedDiffOldVersion,
          newVersion: result.detailedDiffNewVersion,
          cells: result.detailedDiffChangedCells
        });
      } else {
        setDetailedDiff(null);
      }

      setLogisticsRisks(result.logisticsRisks);
      setCoverageDashboard(parseCoverageDashboard(result.coverageDashboard));
      setRiskDashboardOpen(true);
      setRiskPointsOpen(false);
      const analyzedAt = formatAnalysisTimestamp(result.dashboardAnalyzedAt ?? null);
      setLastSavedAnalysisAt(analyzedAt);
      if (result.fileBase64) {
        setSessionAnalysisAt(analyzedAt);
      }
      setIsAnalyzing(false);
      try {
        const snapshot = await agentsApi.getAveonDashboardLatest({ skipRefresh: true });
        if (snapshot?.coverageDashboard) {
          setCoverageDashboard(parseCoverageDashboard(snapshot.coverageDashboard));
        }
        if (snapshot?.taskDashboard?.values.length) {
          const board = {
            values: snapshot.taskDashboard.values,
            rowPriorities: snapshot.taskDashboard.rowPriorities,
            rowKinds: snapshot.taskDashboard.rowKinds,
            meta: snapshot.taskDashboard.meta
          };
          setTaskBoard(board);
          if (Object.keys(snapshot.taskDashboard.resultTexts).length > 0) {
            setShiftResultTexts(snapshot.taskDashboard.resultTexts);
          }
          if (Object.keys(snapshot.taskDashboard.resultEvals).length > 0) {
            setShiftResultEvals(snapshot.taskDashboard.resultEvals);
          }
        }
        if (snapshot?.mergedShipmentSchedule) {
          setMergedShipmentSchedule({
            fileName: snapshot.mergedShipmentSchedule.fileName,
            fileBase64: snapshot.mergedShipmentSchedule.fileBase64,
            values: snapshot.mergedShipmentSchedule.values,
            stats: snapshot.mergedShipmentSchedule.stats,
            sourceCount: snapshot.mergedShipmentSchedule.sourceCount,
            changedCells: snapshot.mergedShipmentSchedule.changedCells
          });
        }
      } catch {
        // merged schedule optional for UI
      }
      logAveonScheduleSnapshotStatus();
    } catch (caughtError) {
      setError(extractAnalyzeError(caughtError) || "Не удалось выполнить анализ");
      setActiveStageIndex(0);
    } finally {
      window.clearInterval(stageTimer);
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, requiredFilesValid, stagedFiles]);

  const logisticsRiskTotal = useMemo(
    () => logisticsRisks?.stages.reduce((sum, stage) => sum + stage.items.length, 0) ?? 0,
    [logisticsRisks]
  );

  const formatRuDate = useCallback((iso: string | null | undefined) => {
    if (!iso) return "—";
    const [year, month, day] = iso.split("-");
    if (!year || !month || !day) return iso;
    return `${day}.${month}.${year}`;
  }, []);

  const fetchCustomCoveragePeriod = useCallback(
    async (dateFrom: string, dateTo: string): Promise<CoveragePeriodPayload | null> => {
      try {
        const response = await agentsApi.getCoverageDashboardPeriod(dateFrom, dateTo);
        if (!response?.ok) return null;
        return parseCoveragePeriod(response.period);
      } catch (error) {
        if (isAxiosError(error)) {
          const detail = error.response?.data;
          if (typeof detail === "string" && detail.trim()) {
            throw new Error(detail);
          }
          if (detail && typeof detail === "object" && "detail" in detail) {
            const message = (detail as { detail?: unknown }).detail;
            if (typeof message === "string" && message.trim()) {
              throw new Error(message);
            }
          }
        }
        throw error instanceof Error ? error : new Error("Не удалось пересчитать период.");
      }
    },
    []
  );

  useEffect(() => {
    if (!logisticsRisks?.stages.length) {
      setSelectedRiskStageKey("");
      setRiskItemFilter("all");
      setFlippedRiskTile(null);
      setVirtualRiskFilter(null);
      setOpenSupplierKeys(new Set());
      return;
    }
    setSelectedRiskStageKey(getDefaultRiskStageKey(logisticsRisks.stages));
    setRiskItemFilter("all");
    setFlippedRiskTile(null);
    setVirtualRiskFilter(null);
  }, [logisticsRisks]);

  const allStageItems = useMemo(
    () => logisticsRisks?.stages.flatMap((stage) => stage.items) ?? [],
    [logisticsRisks]
  );

  const globalRiskStats = useMemo(() => {
    const total = allStageItems.length;
    const atRisk = allStageItems.filter(isItemAtRisk).length;
    const onTrack = allStageItems.filter(isItemOnTrack).length;
    const critical = allStageItems.filter(isItemCritical).length;
    return { total, atRisk, onTrack, critical };
  }, [allStageItems]);

  const riskTileValues: Record<RiskItemFilter, number> = {
    all: globalRiskStats.total,
    at_risk: globalRiskStats.atRisk,
    on_track: globalRiskStats.onTrack,
    critical: globalRiskStats.critical
  };

  const selectedRiskStage = useMemo((): LogisticsRiskStageView | null => {
    const virtualFilter = parseVirtualStageFilter(selectedRiskStageKey);
    if (virtualFilter) {
      return {
        key: selectedRiskStageKey,
        label: VIRTUAL_STAGE_LABELS[virtualFilter],
        items: filterRiskItems(allStageItems, virtualFilter)
      };
    }
    return logisticsRisks?.stages.find((stage) => stage.key === selectedRiskStageKey) ?? null;
  }, [allStageItems, logisticsRisks, selectedRiskStageKey]);

  const isVirtualStageSelected = Boolean(parseVirtualStageFilter(selectedRiskStageKey));

  const filteredStageItems = useMemo(() => {
    if (!selectedRiskStage) return [];
    // Временный бадж уже содержит позиции плитки — повторно не фильтруем
    if (isVirtualStageSelected) return selectedRiskStage.items;
    return filterRiskItems(selectedRiskStage.items, riskItemFilter);
  }, [isVirtualStageSelected, riskItemFilter, selectedRiskStage]);

  useEffect(() => {
    if (selectedRiskStageKey && !parseVirtualStageFilter(selectedRiskStageKey)) {
      lastRealStageKeyRef.current = selectedRiskStageKey;
    }
  }, [selectedRiskStageKey]);

  const openVirtualRiskStage = useCallback((filter: RiskItemFilter) => {
    setVirtualRiskFilter(filter);
    setRiskItemFilter(filter);
    setSelectedRiskStageKey(virtualStageKey(filter));
    window.requestAnimationFrame(() => {
      riskStageContentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const applyTileFilterToActiveStage = useCallback(
    (filter: RiskItemFilter) => {
      setVirtualRiskFilter(null);
      setRiskItemFilter(filter);
      const realKey =
        (selectedRiskStageKey && !parseVirtualStageFilter(selectedRiskStageKey)
          ? selectedRiskStageKey
          : null) ||
        lastRealStageKeyRef.current ||
        (logisticsRisks?.stages.length ? getDefaultRiskStageKey(logisticsRisks.stages) : "");
      if (realKey) {
        setSelectedRiskStageKey(realKey);
      }
    },
    [logisticsRisks, selectedRiskStageKey]
  );

  /**
   * ЛКМ — переключение фильтра плитки:
   * нечётный: только активная стадия; чётный: все стадии (временный бадж).
   */
  const handleRiskTileLeftClick = useCallback(
    (filter: RiskItemFilter) => {
      const onActiveStageForThisTile =
        !parseVirtualStageFilter(selectedRiskStageKey) && riskItemFilter === filter;
      if (onActiveStageForThisTile) {
        openVirtualRiskStage(filter);
      } else {
        applyTileFilterToActiveStage(filter);
      }
    },
    [
      applyTileFilterToActiveStage,
      openVirtualRiskStage,
      riskItemFilter,
      selectedRiskStageKey
    ]
  );

  /** ПКМ — переворот плитки (сводка «как считается»). */
  const handleRiskTileRightClick = useCallback(
    (event: ReactMouseEvent, filter: RiskItemFilter) => {
      event.preventDefault();
      event.stopPropagation();
      setFlippedRiskTile((current) => (current === filter ? null : filter));
    },
    []
  );

  const handleRiskStageBadgeClick = useCallback((stageKey: string) => {
    setFlippedRiskTile(null);
    setRiskItemFilter("all");
    if (!parseVirtualStageFilter(stageKey)) {
      setVirtualRiskFilter(null);
    }
    setSelectedRiskStageKey(stageKey);
  }, []);

  const dismissVirtualRiskStage = useCallback(() => {
    setVirtualRiskFilter(null);
    setFlippedRiskTile(null);
    if (parseVirtualStageFilter(selectedRiskStageKey) && logisticsRisks?.stages.length) {
      const realKey =
        lastRealStageKeyRef.current || getDefaultRiskStageKey(logisticsRisks.stages);
      setSelectedRiskStageKey(realKey);
      setRiskItemFilter("all");
    }
  }, [logisticsRisks, selectedRiskStageKey]);

  useEffect(() => {
    if (!filteredStageItems.length) {
      setOpenSupplierKeys(new Set());
      return;
    }
    const groups = groupItemsBySupplier(filteredStageItems);
    setOpenSupplierKeys(new Set(groups.map((group) => group.key)));
  }, [filteredStageItems]);

  const selectedStageSupplierGroups = useMemo(
    () => (filteredStageItems.length ? groupItemsBySupplier(filteredStageItems) : []),
    [filteredStageItems]
  );

  const toggleSupplierGroup = useCallback((supplierKey: string) => {
    setOpenSupplierKeys((current) => {
      const next = new Set(current);
      if (next.has(supplierKey)) {
        next.delete(supplierKey);
      } else {
        next.add(supplierKey);
      }
      return next;
    });
  }, []);

  const showInlineStages = isAnalyzing || Boolean(sessionAnalysisAt);
  const showStagesCompactBar =
    Boolean(sessionAnalysisAt) &&
    !isAnalyzing &&
    stagesInlineHidden;

  useEffect(() => {
    if (sessionAnalysisAt && !isAnalyzing) {
      const collapseTimer = window.setTimeout(() => setStagesCompact(true), 550);
      return () => window.clearTimeout(collapseTimer);
    }
    return undefined;
  }, [sessionAnalysisAt, isAnalyzing]);

  useEffect(() => {
    if (!stagesOverlayOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setStagesOverlayOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stagesOverlayOpen]);

  const handleStagesCollapseTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLDivElement>) => {
      if (event.propertyName !== "grid-template-rows") return;
      if (stagesCompact && !stagesInlineHidden) {
        setStagesInlineHidden(true);
      }
    },
    [stagesCompact, stagesInlineHidden]
  );

  const toggleStagesOverlay = useCallback(() => {
    setStagesOverlayOpen((current) => !current);
  }, []);

  const renderAnalysisStageRows = () =>
    analysisStages.map((stage, index) => {
      const isCompleted = isAnalyzing ? index < activeStageIndex : Boolean(sessionAnalysisAt);
      const isActive = isAnalyzing && index === activeStageIndex;
      return (
        <div
          key={stage}
          className={`${styles.stageRow} ${isCompleted ? styles.stageRowDone : ""} ${
            isActive ? styles.stageRowActive : ""
          }`}
        >
          <span className={styles.stageDot}>{index + 1}</span>
          <span>{stage}</span>
        </div>
      );
    });

  const isCheckingUploadedFiles =
    isClassifyingRoles ||
    isMergingShipments ||
    isPruningSchedules ||
    isPruningDetailedSchedules ||
    stagedFiles.some(
      (item) => item.roleStatus === "loading" || item.roleStatus === "pending"
    );

  const sessionStatusBadge = (() => {
    if (sessionAnalysisAt) {
      return (
        <span className={`${styles.statusBadge} ${styles.statusBadgeSuccess}`}>
          result.xlsx сформирован
        </span>
      );
    }
    if (isAnalyzing) {
      return (
        <span className={`${styles.statusBadge} ${styles.statusBadgeProgress}`}>
          Агент выполняет анализ
        </span>
      );
    }
    if (!stagedFiles.length) {
      return null;
    }
    if (isCheckingUploadedFiles) {
      return (
        <span className={`${styles.statusBadge} ${styles.statusBadgeProgress}`}>
          Проверяем файлы
        </span>
      );
    }
    if (rolesSettled) {
      return (
        <span className={`${styles.statusBadge} ${styles.statusBadgeSuccess}`}>
          Роли определены
        </span>
      );
    }
    if (!dbSourcesReady) {
      return (
        <span className={`${styles.statusBadge} ${styles.statusBadgeDanger}`}>
          Нет данных в БД
        </span>
      );
    }
    if (!onecSourcesReady) {
      return (
        <span className={`${styles.statusBadge} ${styles.statusBadgeDanger}`}>
          Нужна выгрузка из 1С
        </span>
      );
    }
    if (missingRequiredRoles.length > 0) {
      return (
        <span className={`${styles.statusBadge} ${styles.statusBadgeDanger}`}>
          Не хватает файлов
        </span>
      );
    }
    if (!shipmentSourcesReady) {
      return (
        <span className={`${styles.statusBadge} ${styles.statusBadgeDanger}`}>
          Нет источника графика
        </span>
      );
    }
    return null;
  })();

  return (
    <div
      data-avion-agent
      className={`${styles.page} ${stagesOverlayOpen ? styles.pageStagesOverlayOpen : ""}`}
    >
      {!hideCatalogLink ? (
        <Link to="/agents" className={styles.backLink}>
          <ArrowLeft size={16} strokeWidth={2.1} aria-hidden="true" />
          К каталогу агентов
        </Link>
      ) : null}

      <header className={styles.hero}>
        <h1>{mockDocumentAnalysisAgent.name}</h1>
        <p>{documentAnalysisAgentSubtitle}</p>
      </header>

      <div className={styles.workspace}>
        <section className={styles.panel} aria-label="Загрузка файлов">
          <div>
            <h2 className={styles.panelTitle}>Файлы для анализа</h2>
            <p className={styles.panelHint}>
              Перетащите документы в область ниже или выберите их вручную. Поддерживаются {acceptedHint}.
              Годовой график, графики комплектующих и справочники берутся из БД; Excel-файлы нужны только для
              переопределения.
            </p>
          </div>

          <div
            className={`${styles.dropZone} ${isDragOver ? styles.dropZoneDragOver : ""} ${
              isAnalyzing ? styles.dropZoneDisabled : ""
            }`}
            onDragEnter={isAnalyzing ? undefined : handleDragEnter}
            onDragLeave={isAnalyzing ? undefined : handleDragLeave}
            onDragOver={isAnalyzing ? undefined : handleDragOver}
            onDrop={isAnalyzing ? undefined : handleDrop}
            aria-disabled={isAnalyzing}
          >
            {isDragOver ? (
              <div className={styles.dropOverlay} aria-hidden="true">
                <span className={styles.dropOverlayIcon}>
                  <Upload size={24} strokeWidth={2} />
                </span>
                <strong>Отпустите файлы для загрузки</strong>
                <span>Можно добавить несколько документов сразу</span>
              </div>
            ) : null}

            <div className={styles.dropZoneInner}>
              <span className={styles.dropZoneIcon}>
                <CloudUpload size={24} strokeWidth={2} />
              </span>
              <strong>Перетащите файлы сюда</strong>
              <span>или выберите документы кнопкой ниже</span>
            </div>
          </div>

          <div className={styles.uploadActions}>
            <label className={`${styles.fileButton} ${isAnalyzing ? styles.fileButtonDisabled : ""}`}>
              Выбрать файлы
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={documentAnalysisAcceptedExtensions.join(",")}
                disabled={isAnalyzing}
                onChange={(event) => {
                  if (event.target.files?.length) {
                    addFiles(event.target.files);
                  }
                  event.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleAnalyze}
              disabled={!requiredFilesValid || isAnalyzing}
              title={
                isMergingShipments
                  ? "Дождитесь объединения графиков отгрузок"
                  : !dbSourcesReady
                    ? "Проверьте данные в БД: годовой график, Россия, Китай"
                    : !onecSourcesReady
                      ? "Выгрузите остатки, спецификации и план из 1С"
                      : !rolesSettled
                        ? "Дождитесь определения ролей загруженных Excel"
                        : !requiredFilesValid
                          ? "Не все источники готовы к анализу"
                          : undefined
              }
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={16} strokeWidth={2.2} aria-hidden="true" className={styles.spin} />
                  Анализируем…
                </>
              ) : (
                <>
                  <FileSearch size={16} strokeWidth={2.2} aria-hidden="true" />
                  Анализировать
                </>
              )}
            </button>
            {stagedFiles.length ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  classifyRequestIdRef.current += 1;
                  setStagedFiles([]);
                  setError(null);
                  // дашборд прошлого анализа не сбрасываем — только очередь файлов
                  setSelectedRiskStageKey("");
                  setRiskItemFilter("all");
                  setOpenSupplierKeys(new Set());
                  setStagesCompact(Boolean(sessionAnalysisAt));
                  setStagesInlineHidden(Boolean(sessionAnalysisAt));
                  setStagesOverlayOpen(false);
                  setRolesSource(null);
                  setIsClassifyingRoles(false);
                  setIsMergingShipments(false);
                  setMergeSourceNames([]);
                  lastShipmentMergeKeyRef.current = "";
                  mergeInFlightRef.current = false;
                  setIsPruningSchedules(false);
                  lastSchedulePruneKeyRef.current = "";
                  schedulePruneInFlightRef.current = false;
                  setSchedulePruneNotice(null);
                  setIsPruningDetailedSchedules(false);
                  lastDetailedPruneKeyRef.current = "";
                  detailedPruneInFlightRef.current = false;
                  setDetailedPruneNotice(null);
                  setScheduleDiff(null);
                  setDetailedDiff(null);
                }}
                disabled={isAnalyzing}
              >
                Очистить список
              </button>
            ) : null}
          </div>

          {schedulePruneNotice ? (
            <p className={styles.schedulePruneNotice} role="status">
              {schedulePruneNotice}
            </p>
          ) : null}
          {detailedPruneNotice ? (
            <p className={styles.schedulePruneNotice} role="status">
              {detailedPruneNotice}
            </p>
          ) : null}
          {shipmentManualChangeNotices.length ? (
            <div className={styles.scheduleDiffBlock} role="status">
              {shipmentManualChangeNotices.map((notice) => (
                <div key={notice.id} className={styles.scheduleDiffNotice}>
                  <AlertTriangle size={18} aria-hidden />
                  <div className={styles.scheduleDiffNoticeText}>
                    <strong>Нужно обновить Google форму</strong>
                    <span>{notice.message}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {dashboardRefreshWarning ? (
            <p className={styles.errorText} role="alert">
              {dashboardRefreshWarning}
            </p>
          ) : null}
          {error ? (
            <p className={styles.errorText} role="alert">
              {error}
            </p>
          ) : null}
          {stagedFiles.length ? (
            <p className={styles.rolesHint}>
              {isMergingShipments
                ? `Объединяем графики отгрузок (${mergeSourceNames.length})…`
                : isPruningSchedules
                  ? "Отбираем 2 последние версии графика производства…"
                  : isPruningDetailedSchedules
                    ? "Отбираем 2 последние версии детального графика производства…"
                    : isClassifyingRoles
                      ? "Определяем роли файлов…"
                      : rolesSource
                        ? `Роли определены (${rolesSource === "lm_studio" ? "LM Studio" : "локально"}) — агент ещё не запущен`
                        : "Роли появятся после распознавания файлов"}
            </p>
          ) : null}

          {isMergingShipments ? (
            <div className={styles.shipmentMergeBanner} role="status" aria-live="polite">
              <Loader2 size={16} className={styles.shipmentMergeSpinner} aria-hidden="true" />
              <span>
                Склеиваем {mergeSourceNames.length} файла графика отгрузок в один…
              </span>
            </div>
          ) : null}

          <div className={styles.fileList}>
            {stagedFiles.length ? (
              stagedFiles.map((item) => {
                const roleLabel = item.role ? (ROLE_LABELS[item.role] ?? item.role) : null;
                const isMergingCard = item.mergeStatus === "merging";
                const isMergedCard = item.isMergedShipment;
                return (
                  <article
                    key={item.id}
                    className={`${styles.fileCard} ${isMergingCard ? styles.fileCardMerging : ""} ${isMergedCard ? styles.fileCardMerged : ""}`}
                  >
                    <div className={styles.fileIconWrap}>
                      {!isAnalyzing && !isMergingShipments ? (
                        <button
                          type="button"
                          className={styles.removeButton}
                          aria-label={`Удалить ${item.file.name}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setStagedFiles((current) => current.filter((entry) => entry.id !== item.id));
                          }}
                        >
                          <Trash2 size={13} strokeWidth={2.2} aria-hidden="true" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.fileOpenButton}
                        aria-label={`Открыть ${item.file.name} в новой вкладке`}
                        title={`Открыть таблицу в новой вкладке: ${item.file.name}`}
                        onClick={() => {
                          void openLocalFile(item.file).catch((error) => {
                            console.error("Не удалось открыть файл", error);
                            window.alert(
                              error instanceof Error
                                ? error.message
                                : "Не удалось открыть файл в новой вкладке."
                            );
                          });
                        }}
                      >
                        <span
                          className={`${styles.fileIcon} ${isMergingCard ? styles.fileIconMerging : ""} ${isMergedCard ? styles.fileIconMerged : ""}`}
                        >
                          {isMergingCard ? (
                            <Loader2 size={28} strokeWidth={2} className={styles.shipmentMergeSpinner} aria-hidden="true" />
                          ) : isMergedCard ? (
                            <Layers size={28} strokeWidth={1.8} aria-hidden="true" />
                          ) : (
                            <FileSpreadsheet size={30} strokeWidth={1.8} aria-hidden="true" />
                          )}
                        </span>
                      </button>
                    </div>
                    <div className={styles.fileMeta}>
                      <button
                        type="button"
                        className={styles.fileNameButton}
                        title={`Открыть таблицу в новой вкладке: ${item.file.name}`}
                        onClick={() => {
                          void openLocalFile(item.file).catch((error) => {
                            console.error("Не удалось открыть файл", error);
                            window.alert(
                              error instanceof Error
                                ? error.message
                                : "Не удалось открыть файл в новой вкладке."
                            );
                          });
                        }}
                      >
                        <strong>{item.file.name}</strong>
                      </button>
                      <span>{formatBytes(item.file.size)}</span>
                      {item.roleStatus === "loading" || item.roleStatus === "pending" ? (
                        <span className={styles.fileRoleBadgePending}>определяем роль…</span>
                      ) : item.mergeStatus === "merging" ? (
                        <span className={styles.fileRoleBadgeMerging}>склеиваем…</span>
                      ) : item.roleStatus === "error" ? (
                        <span className={styles.fileRoleBadgeError}>роль не определена</span>
                      ) : isMergedCard ? (
                        <span
                          className={styles.fileRoleBadgeMerged}
                          title={`Объединено из ${item.mergedSourceCount ?? 0} файлов`}
                        >
                          объединённый график
                        </span>
                      ) : roleLabel ? (
                        <span className={styles.fileRoleBadge} title={item.role ?? undefined}>
                          {roleLabel}
                        </span>
                      ) : null}
                    </div>
                  </article>
                );
              })
            ) : (
              <p className={styles.fileListEmpty}>Файлы ещё не добавлены. Загрузите документы для анализа.</p>
            )}
          </div>
        </section>

        <aside className={styles.panel} aria-label="Сводка агента">
          <SummaryReferencePanel
            cache={referenceCache}
            backFooter={
              <>
                {shipmentSourceError ? <p className={styles.errorText}>{shipmentSourceError}</p> : null}
                {user?.is_superuser ? (
                  <div className={styles.uploadActions}>
                    <input
                      ref={russiaShipmentInputRef}
                      type="file"
                      accept=".xlsx,.xlsm"
                      hidden
                      onChange={(event) => {
                        void handleRussiaShipmentUpload(event.target.files?.[0]);
                      }}
                    />
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={russiaShipmentUploadLoading}
                      onClick={() => russiaShipmentInputRef.current?.click()}
                    >
                      {russiaShipmentUploadLoading
                        ? "Загружаем график…"
                        : "Загрузить график России в БД"}
                    </button>
                  </div>
                ) : null}
              </>
            }
          >
          <div className={styles.stagePanel} aria-label="Текущая сессия">
            <h3 className={styles.stagePanelTitle}>Текущая сессия</h3>
            <div className={styles.stageRow}>
              <span className={styles.stageDot}>1</span>
              <span className={styles.requiredFileRowText}>
                <span className={styles.requiredFileRowLabel}>Файлов в очереди</span>
                <span className={styles.requiredFileRowHint}>{stagedFiles.length}</span>
              </span>
            </div>
            <div className={styles.stageRow}>
              <span className={styles.stageDot}>2</span>
              <span className={styles.requiredFileRowText}>
                <span className={styles.requiredFileRowLabel}>Общий объём</span>
                <span className={styles.requiredFileRowHint}>
                  {formatBytes(stagedFiles.reduce((sum, item) => sum + item.file.size, 0))}
                </span>
              </span>
            </div>
            <div className={styles.stageRow}>
              <span className={styles.stageDot}>3</span>
              <span className={styles.requiredFileRowText}>
                <span className={styles.requiredFileRowLabel}>Последний запрос</span>
                <span className={styles.requiredFileRowHint}>{lastSavedAnalysisAt ?? "—"}</span>
              </span>
            </div>
          </div>

          {sessionStatusBadge}

          <div className={styles.shiftAssignmentBlock}>
            <div className={styles.tempSyncAction}>
              <button
                type="button"
                className={styles.tempOdataPingButton}
                disabled={onecManualSyncLoading}
                onClick={() => void handleOnecManualSync()}
              >
                {onecManualSyncLoading
                  ? "Выгрузка из 1С…"
                  : "Выгрузить остатки, спецификации и план из 1С"}
              </button>
              <TempOnecSyncHint
                stock={onecStockStatus}
                specs={onecSpecsStatus}
                productionPlan={onecProductionPlanStatus}
                loading={onecSyncStatusLoading && !onecManualSyncResult}
                manualSyncInProgress={onecManualSyncLoading}
              />
              <TempOnecSyncProgress progress={onecManualSyncProgress} />
              <TempOnecSyncResult view={onecManualSyncResult} />
            </div>
          </div>

          {scheduleDiff ? (
            <div className={styles.scheduleDiffBlock} role="status">
              <div
                className={`${styles.scheduleDiffNotice} ${
                  scheduleDiff.kind === "baseline"
                    ? styles.scheduleDiffNoticeBaseline
                    : scheduleDiff.kind === "unchanged"
                      ? styles.scheduleDiffNoticeNeutral
                      : ""
                }`}
              >
                {scheduleDiff.kind === "baseline" ? (
                  <CheckCircle2 size={18} aria-hidden />
                ) : scheduleDiff.kind === "unchanged" ? (
                  <Info size={18} aria-hidden />
                ) : (
                  <AlertTriangle size={18} aria-hidden />
                )}
                <div className={styles.scheduleDiffNoticeText}>
                  <strong>
                    {scheduleDiff.kind === "baseline"
                      ? "Базовая версия графика сохранена"
                      : scheduleDiff.kind === "unchanged"
                        ? "Изменений в плане производства нет"
                        : "Изменился план производства"}
                  </strong>
                  <span>
                    {scheduleDiff.message ||
                      (scheduleDiff.kind === "changed"
                        ? `Версии ${scheduleDiff.oldVersion} → ${scheduleDiff.newVersion}`
                        : "")}
                  </span>
                  {scheduleDiff.kind === "changed" && scheduleDiff.months.length ? (
                    <div className={styles.scheduleDiffMonths} aria-label="Месяцы с расхождениями">
                      {scheduleDiff.months.map((month) => (
                        <span key={month} className={styles.scheduleDiffMonthChip}>
                          {month}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              {scheduleDiff.kind === "changed" && scheduleDiff.fileBase64 ? (
                <button
                  type="button"
                  className={styles.scheduleDiffDownloadButton}
                  onClick={() =>
                    downloadBase64Excel(scheduleDiff.fileBase64, scheduleDiff.fileName)
                  }
                >
                  <Download size={18} aria-hidden />
                  <span className={styles.shiftAssignmentButtonText}>
                    <span className={styles.shiftAssignmentButtonLabel}>
                      Скачать файл с расхождениями
                    </span>
                    <span className={styles.shiftAssignmentButtonMeta}>
                      было / стало{scheduleDiff.cells ? ` · ${scheduleDiff.cells} яч.` : ""}
                    </span>
                  </span>
                  <FileSpreadsheet size={18} aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null}

          {detailedDiff ? (
            <div className={styles.scheduleDiffBlock} role="status">
              <div
                className={`${styles.scheduleDiffNotice} ${
                  detailedDiff.kind === "baseline"
                    ? styles.scheduleDiffNoticeBaseline
                    : detailedDiff.kind === "unchanged"
                      ? styles.scheduleDiffNoticeNeutral
                      : ""
                }`}
              >
                {detailedDiff.kind === "baseline" ? (
                  <CheckCircle2 size={18} aria-hidden />
                ) : detailedDiff.kind === "unchanged" ? (
                  <Info size={18} aria-hidden />
                ) : (
                  <AlertTriangle size={18} aria-hidden />
                )}
                <div className={styles.scheduleDiffNoticeText}>
                  <strong>
                    {detailedDiff.kind === "baseline"
                      ? "Базовая версия детального графика сохранена"
                      : detailedDiff.kind === "unchanged"
                        ? "Изменений в детальном плане нет"
                        : "Изменился детальный план производства"}
                  </strong>
                  <span>
                    {detailedDiff.message ||
                      (detailedDiff.kind === "changed"
                        ? `Версии ${detailedDiff.oldVersion} → ${detailedDiff.newVersion}`
                        : "")}
                  </span>
                  {detailedDiff.kind === "changed" && detailedDiff.dates.length ? (
                    <div className={styles.scheduleDiffMonths} aria-label="Даты с расхождениями">
                      {detailedDiff.dates.map((day) => (
                        <span key={day} className={styles.scheduleDiffMonthChip}>
                          {day}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              {detailedDiff.kind === "changed" && detailedDiff.fileBase64 ? (
                <button
                  type="button"
                  className={styles.scheduleDiffDownloadButton}
                  onClick={() =>
                    downloadBase64Excel(detailedDiff.fileBase64, detailedDiff.fileName)
                  }
                >
                  <Download size={18} aria-hidden />
                  <span className={styles.shiftAssignmentButtonText}>
                    <span className={styles.shiftAssignmentButtonLabel}>
                      Скачать файл с расхождениями
                    </span>
                    <span className={styles.shiftAssignmentButtonMeta}>
                      было / стало{detailedDiff.cells ? ` · ${detailedDiff.cells} яч.` : ""}
                    </span>
                  </span>
                  <FileSpreadsheet size={18} aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null}

          {visibleShiftAssignment ? (
            <div className={styles.shiftAssignmentBlock}>
              <button
                type="button"
                className={styles.shiftAssignmentButton}
                onClick={() => openScheduleFlipModal("shift")}
              >
                <FileSpreadsheet size={18} aria-hidden />
                <span className={styles.shiftAssignmentButtonText}>
                  <span className={styles.shiftAssignmentButtonLabel}>
                    {managerScope ? "Мои задания" : "Сменное задание"}
                  </span>
                  <span className={styles.shiftAssignmentButtonMeta}>
                    {visibleShiftAssignment.meta?.taskCount
                      ? `${visibleShiftAssignment.meta.taskCount} заданий${
                          managerScope ? "" : " · для менеджера по закупкам"
                        }`
                      : managerScope
                        ? "открыть таблицу"
                        : "для менеджера по закупкам"}
                  </span>
                </span>
                <ChevronRight size={18} aria-hidden />
              </button>
            </div>
          ) : null}

          {shipmentScheduleAvailable ? (
            <div className={styles.shiftAssignmentBlock}>
              <button
                type="button"
                className={styles.shiftAssignmentButton}
                onClick={() => openScheduleFlipModal("shipment")}
              >
                <FileSpreadsheet size={18} aria-hidden />
                <span className={styles.shiftAssignmentButtonText}>
                  <span className={styles.shiftAssignmentButtonLabel}>
                    График получения комплектующих
                  </span>
                  <span className={styles.shiftAssignmentButtonMeta}>
                    {isMergingShipments
                      ? "объединение файлов…"
                      : mergedShipmentPreviewLoading
                        ? "загрузка таблицы…"
                        : mergedShipmentSchedule?.stats?.nomenclature_total != null
                          ? `объединённый · ${mergedShipmentSchedule.stats.nomenclature_total} номенклатур`
                          : mergedShipmentSchedule?.values?.length
                            ? `объединённый · ${Math.max(mergedShipmentSchedule.values.length - 1, 0)} номенклатур`
                            : "объединённый · открыть таблицу"}
                  </span>
                </span>
                <ChevronRight size={18} aria-hidden />
              </button>
            </div>
          ) : null}

          {shipmentManualChangeNotices.length ? (
            <div className={styles.scheduleDiffBlock} role="alert">
              {shipmentManualChangeNotices.map((notice) => (
                <div key={notice.id} className={styles.scheduleDiffNotice}>
                  <AlertTriangle size={18} aria-hidden />
                  <div className={styles.scheduleDiffNoticeText}>
                    <strong>Измените Google форму по Китаю</strong>
                    <span>{notice.message}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <ScheduleFlipModal
            open={scheduleFlipModalOpen}
            face={scheduleFlipModalFace}
            onFaceChange={setScheduleFlipModalFace}
            onClose={closeScheduleFlipModal}
            shift={scheduleFlipShiftProps}
            shipment={scheduleFlipShipmentProps}
          />

          <div className={styles.stagesSection} ref={stagesSectionRef}>
            {showInlineStages && !stagesInlineHidden ? (
              <div
                className={`${styles.stagePanelWrap} ${
                  stagesCompact && sessionAnalysisAt ? styles.stagePanelWrapCollapsing : ""
                }`}
                onTransitionEnd={handleStagesCollapseTransitionEnd}
              >
                <div className={styles.stagePanelWrapInner}>
                  <div className={styles.stagePanel} aria-label="Этапы анализа">
                    {renderAnalysisStageRows()}
                  </div>
                </div>
              </div>
            ) : null}

            {showStagesCompactBar ? (
              <button
                type="button"
                className={styles.stagesCompactToggle}
                aria-expanded={stagesOverlayOpen}
                aria-controls="analysis-stages-overlay"
                onClick={toggleStagesOverlay}
              >
                <span className={styles.stagesCompactToggleMain}>
                  <span className={styles.stagesCompactToggleLabel}>Этапы анализа</span>
                  <span className={styles.stagesCompactToggleMeta}>
                    {analysisStages.length} этапов · завершено
                  </span>
                </span>
                <span className={styles.stagesCompactToggleAction}>
                  {stagesOverlayOpen ? "Скрыть" : "Показать этапы"}
                  {stagesOverlayOpen ? (
                    <ChevronUp size={16} strokeWidth={2.2} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
                  )}
                </span>
              </button>
            ) : null}

            {stagesOverlayOpen && showStagesCompactBar ? (
                <div
                  id="analysis-stages-overlay"
                  className={styles.stagesOverlay}
                  role="region"
                  aria-label="Этапы анализа"
                >
                  <div className={styles.stagesOverlayHeader}>
                    <strong>Этапы анализа</strong>
                    <button
                      type="button"
                      className={styles.stagesOverlayClose}
                      aria-label="Скрыть этапы"
                      onClick={() => setStagesOverlayOpen(false)}
                    >
                      <ChevronUp size={16} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  </div>
                  <div className={styles.stagePanel}>{renderAnalysisStageRows()}</div>
                </div>
            ) : null}
          </div>
          </SummaryReferencePanel>
        </aside>
      </div>

      {!coverageDashboard && (isLoadingLatestDashboard || isAnalyzing) ? (
        <CoverageDashboardLoading mode={isAnalyzing ? "analyzing" : "loading"} />
      ) : null}

      {coverageDashboard ? (
        <CoverageDashboard
          dashboard={coverageDashboard}
          formatDate={formatRuDate}
          onFetchCustomPeriod={fetchCustomCoveragePeriod}
          managerTasks={
            visibleTaskBoard
              ? {
                  values: visibleTaskBoard.values,
                  rowPriorities: visibleTaskBoard.rowPriorities,
                  rowKinds: visibleTaskBoard.rowKinds,
                  meta: visibleTaskBoard.meta,
                  resultTexts: shiftResultTexts,
                  resultEvals: shiftResultEvals,
                  onResultTextsChange: setShiftResultTexts,
                  onResultEvalsChange: setShiftResultEvals,
                  onManagerResultEvaluated: handleManagerResultEvaluated,
                  manualShipmentNotices: shipmentManualChangeNotices,
                  dashboardOpen: riskDashboardOpen,
                  tasksOpen: riskPointsOpen,
                  onDashboardOpenChange: setRiskDashboardOpen,
                  onTasksOpenChange: setRiskPointsOpen,
                  onOpenShiftModal: visibleShiftAssignment
                    ? () => openScheduleFlipModal("shift")
                    : undefined,
                  onOpenShipmentModal: shipmentScheduleAvailable
                    ? () => openScheduleFlipModal("shipment")
                    : undefined
                }
              : null
          }
          managerTasksNotice={managerScope ? managerTasksNotice : null}
          managerResults={managerResultsBundle}
        />
      ) : null}

      {visibleTaskBoard && !coverageDashboard && !isLoadingLatestDashboard && !isAnalyzing ? (
        <ShiftTaskBoard
          values={visibleTaskBoard.values}
          rowPriorities={visibleTaskBoard.rowPriorities}
          rowKinds={visibleTaskBoard.rowKinds}
          meta={visibleTaskBoard.meta}
          resultTexts={shiftResultTexts}
          resultEvals={shiftResultEvals}
          onResultTextsChange={setShiftResultTexts}
          onResultEvalsChange={setShiftResultEvals}
          onManagerResultEvaluated={handleManagerResultEvaluated}
          manualShipmentNotices={shipmentManualChangeNotices}
          dashboardOpen={riskDashboardOpen}
          tasksOpen={riskPointsOpen}
          onDashboardOpenChange={setRiskDashboardOpen}
          onTasksOpenChange={setRiskPointsOpen}
          onOpenShiftModal={
            visibleShiftAssignment ? () => openScheduleFlipModal("shift") : undefined
          }
          onOpenShipmentModal={
            shipmentScheduleAvailable ? () => openScheduleFlipModal("shipment") : undefined
          }
        />
      ) : managerTasksNotice && !coverageDashboard && !isLoadingLatestDashboard && !isAnalyzing ? (
        <section className={styles.riskBoard} aria-label="Сменное задание">
          <ShiftTasksNewDayNotice
            previousValidDate={managerTasksNotice.previousValidDate}
            today={managerTasksNotice.today}
            formatDate={formatRuDate}
          />
        </section>
      ) : !coverageDashboard && logisticsRisks && !isLoadingLatestDashboard && !isAnalyzing ? (
        <section className={styles.riskBoard} aria-label="Контрольные точки логистики">
          <div className={styles.riskBoardHeader}>
            <div>
              <h2 className={styles.panelTitle}>Контрольные точки логистики</h2>
              <p className={styles.panelHint}>
                На {formatRuDate(logisticsRisks.asOf)} — МСК и Ростов показывают позиции внутри окна
                логистики (короткая…длинная). Цвет: зелёный = запас дней, красный = ближе к крайней
                дате.
              </p>
            </div>
            <span className={styles.riskTotalBadge}>
              {logisticsRiskTotal > 0 ? `${logisticsRiskTotal} позиций` : "Нет срабатываний"}
            </span>
          </div>

          <div
            className={`${styles.riskAccordion} ${
              riskDashboardOpen ? styles.riskAccordionOpen : ""
            }`}
          >
            <button
              type="button"
              className={styles.riskAccordionToggle}
              aria-expanded={riskDashboardOpen}
              aria-controls="risk-dashboard-panel"
              id="risk-dashboard-toggle"
              onClick={() => setRiskDashboardOpen((open) => !open)}
            >
              <ChevronDown
                className={styles.riskAccordionChevron}
                size={18}
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <span className={styles.riskAccordionMain}>
                <span className={styles.riskAccordionLabel}>Дашборд</span>
                <span className={styles.riskAccordionMeta}>
                  Плитки и диаграмма ·{" "}
                  {logisticsRiskTotal > 0 ? `${logisticsRiskTotal} позиций` : "без срабатываний"}
                </span>
              </span>
              <span className={styles.riskAccordionAction}>
                {riskDashboardOpen ? "Скрыть" : "Показать"}
              </span>
            </button>
            <div
              id="risk-dashboard-panel"
              className={styles.riskAccordionPanel}
              role="region"
              aria-labelledby="risk-dashboard-toggle"
              aria-hidden={!riskDashboardOpen}
              inert={!riskDashboardOpen ? true : undefined}
            >
              <div className={styles.riskAccordionPanelInner}>
                <div className={styles.riskAnalyticsBlock}>
                  <div className={styles.riskAnalyticsRow}>
                    <div
                      className={styles.riskAnalyticsTiles}
                      role="group"
                      aria-label="Сводка по контрольным точкам"
                    >
                      {RISK_TILES.map((tile) => {
                        const isFlipped = flippedRiskTile === tile.filter;
                        const isVirtualActive =
                          virtualRiskFilter === tile.filter &&
                          selectedRiskStageKey === virtualStageKey(tile.filter);
                        const isStageFilterActive =
                          !isVirtualStageSelected && riskItemFilter === tile.filter;
                        const isTileActive =
                          isVirtualActive || isStageFilterActive || isFlipped;
                        const toneClass =
                          tile.tone === "danger"
                            ? styles.riskAnalyticsTileDanger
                            : tile.tone === "success"
                              ? styles.riskAnalyticsTileSuccess
                              : tile.tone === "critical"
                                ? styles.riskAnalyticsTileCritical
                                : "";
                        const iconToneClass =
                          tile.tone === "danger"
                            ? styles.riskAnalyticsTileIconDanger
                            : tile.tone === "success"
                              ? styles.riskAnalyticsTileIconSuccess
                              : tile.tone === "critical"
                                ? styles.riskAnalyticsTileIconCritical
                                : "";
                        const Icon =
                          tile.filter === "all"
                            ? Package
                            : tile.filter === "at_risk"
                              ? AlertTriangle
                              : tile.filter === "on_track"
                                ? ShieldCheck
                                : Siren;

                        return (
                          <div
                            key={tile.filter}
                            className={styles.riskTileFlipScene}
                            onContextMenu={(event) =>
                              handleRiskTileRightClick(event, tile.filter)
                            }
                          >
                            <div
                              className={`${styles.riskTileFlipCard} ${
                                isFlipped ? styles.riskTileFlipCardFlipped : ""
                              }`}
                            >
                              <button
                                type="button"
                                className={`${styles.riskAnalyticsTile} ${styles.riskTileFace} ${styles.riskTileFaceFront} ${toneClass} ${
                                  isTileActive ? styles.riskAnalyticsTileActive : ""
                                }`}
                                aria-pressed={isVirtualActive || isStageFilterActive}
                                aria-label={`${tile.label}: ${riskTileValues[tile.filter]}. ЛКМ — фильтр, ПКМ — сводка`}
                                onClick={() => handleRiskTileLeftClick(tile.filter)}
                                onContextMenu={(event) =>
                                  handleRiskTileRightClick(event, tile.filter)
                                }
                              >
                                <span
                                  className={`${styles.riskAnalyticsTileIcon} ${iconToneClass}`}
                                  aria-hidden="true"
                                >
                                  <Icon size={24} strokeWidth={2} />
                                </span>
                                <span className={styles.riskAnalyticsTileBody}>
                                  <span className={styles.riskAnalyticsTileLabel}>
                                    {tile.label}
                                  </span>
                                  <strong className={styles.riskAnalyticsTileValue}>
                                    {riskTileValues[tile.filter]}
                                  </strong>
                                </span>
                              </button>
                              <button
                                type="button"
                                className={`${styles.riskAnalyticsTile} ${styles.riskTileFace} ${styles.riskTileFaceBack} ${toneClass} ${
                                  isVirtualActive || isStageFilterActive
                                    ? styles.riskAnalyticsTileActive
                                    : ""
                                }`}
                                aria-pressed={isVirtualActive || isStageFilterActive}
                                aria-label={`${tile.label}: ЛКМ — фильтр, ПКМ — вернуть лицо`}
                                onClick={() => handleRiskTileLeftClick(tile.filter)}
                                onContextMenu={(event) =>
                                  handleRiskTileRightClick(event, tile.filter)
                                }
                              >
                                <span className={styles.riskTileBackContent}>
                                  <span className={styles.riskTileBackTitle}>
                                    {tile.backTitle}
                                  </span>
                                  <span className={styles.riskTileBackRule}>
                                    {tile.backRule}
                                  </span>
                                  <span className={styles.riskTileBackMeta}>
                                    Сейчас: {riskTileValues[tile.filter]} из{" "}
                                    {globalRiskStats.total}
                                  </span>
                                  <span className={styles.riskTileBackHint}>
                                    {tile.backHint}
                                  </span>
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div
                      className={styles.riskDoughnutPanel}
                      aria-label="Соотношение успевающих и под риском"
                    >
                      <RiskDoughnutChart
                        onTrack={globalRiskStats.onTrack}
                        atRisk={globalRiskStats.atRisk}
                        total={globalRiskStats.total}
                        onSelectFilter={(filter) => {
                          setRiskItemFilter(filter);
                          setFlippedRiskTile(null);
                          if (isVirtualStageSelected) {
                            setVirtualRiskFilter(null);
                            if (logisticsRisks.stages.length) {
                              setSelectedRiskStageKey(
                                lastRealStageKeyRef.current ||
                                  getDefaultRiskStageKey(logisticsRisks.stages)
                              );
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <p className={styles.riskAnalyticsHint}>
                    Клик правой кнопкой мыши открывает сводку по плитке.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`${styles.riskAccordion} ${
              riskPointsOpen ? styles.riskAccordionOpen : ""
            }`}
          >
            <button
              type="button"
              className={styles.riskAccordionToggle}
              aria-expanded={riskPointsOpen}
              aria-controls="risk-points-panel"
              id="risk-points-toggle"
              onClick={() => setRiskPointsOpen((open) => !open)}
            >
              <ChevronDown
                className={styles.riskAccordionChevron}
                size={18}
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <span className={styles.riskAccordionMain}>
                <span className={styles.riskAccordionLabel}>Контрольные точки</span>
                <span className={styles.riskAccordionMeta}>
                  {logisticsRisks.stages.length} стадий ·{" "}
                  {logisticsRiskTotal > 0 ? `${logisticsRiskTotal} позиций` : "пусто на сегодня"}
                </span>
              </span>
              <span className={styles.riskAccordionAction}>
                {riskPointsOpen ? "Скрыть" : "Показать"}
              </span>
            </button>
            <div
              id="risk-points-panel"
              className={styles.riskAccordionPanel}
              role="region"
              aria-labelledby="risk-points-toggle"
              aria-hidden={!riskPointsOpen}
              inert={!riskPointsOpen ? true : undefined}
            >
              <div className={styles.riskAccordionPanelInner}>
                <div className={styles.riskPointsBody}>
                  <nav className={styles.riskStageNav} aria-label="Стадии логистики">
                    {logisticsRisks.stages.map((stage, index) => {
                      const isSelected = stage.key === selectedRiskStageKey;
                      const hasItems = stage.items.length > 0;
                      const navLabel = RISK_STAGE_NAV_LABELS[stage.key] ?? stage.label;
                      return (
                        <button
                          key={stage.key}
                          type="button"
                          className={`${styles.riskStageNavBadge} ${
                            isSelected ? styles.riskStageNavBadgeActive : ""
                          } ${
                            hasItems
                              ? styles.riskStageNavBadgeHasItems
                              : styles.riskStageNavBadgeMuted
                          }`}
                          aria-pressed={isSelected}
                          title={stage.label}
                          onClick={() => handleRiskStageBadgeClick(stage.key)}
                        >
                          <span className={styles.riskStageNavIndex}>{index + 1}</span>
                          <span className={styles.riskStageNavLabel}>{navLabel}</span>
                          <span className={styles.riskStageNavCount}>{stage.items.length}</span>
                        </button>
                      );
                    })}
                    {virtualRiskFilter ? (
                      <div className={styles.riskStageNavVirtualWrap}>
                        <button
                          type="button"
                          className={`${styles.riskStageNavBadge} ${styles.riskStageNavBadgeVirtual} ${
                            selectedRiskStageKey === virtualStageKey(virtualRiskFilter)
                              ? styles.riskStageNavBadgeActive
                              : ""
                          } ${styles.riskStageNavBadgeHasItems}`}
                          aria-pressed={
                            selectedRiskStageKey === virtualStageKey(virtualRiskFilter)
                          }
                          title={`${VIRTUAL_STAGE_LABELS[virtualRiskFilter]} · по всем стадиям`}
                          onClick={() =>
                            handleRiskStageBadgeClick(virtualStageKey(virtualRiskFilter))
                          }
                        >
                          <span className={styles.riskStageNavIndex}>
                            {logisticsRisks.stages.length + 1}
                          </span>
                          <span className={styles.riskStageNavLabel}>
                            {VIRTUAL_STAGE_LABELS[virtualRiskFilter]}
                          </span>
                          <span className={styles.riskStageNavCount}>
                            {filterRiskItems(allStageItems, virtualRiskFilter).length}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.riskStageNavDismiss}
                          aria-label="Закрыть временный бадж"
                          onClick={dismissVirtualRiskStage}
                        >
                          ×
                        </button>
                      </div>
                    ) : null}
                  </nav>

                  {selectedRiskStage ? (
                    <div
                      ref={riskStageContentRef}
                      className={`${styles.riskStageContent} ${
                        selectedRiskStage.items.length > 0
                          ? styles.riskStageContentAlert
                          : ""
                      } ${isVirtualStageSelected ? styles.riskStageContentVirtual : ""}`}
                    >
                      <div className={styles.riskStageSummary}>
                        <strong>
                          {isVirtualStageSelected
                            ? `${selectedRiskStage.label} · все стадии`
                            : selectedRiskStage.label}
                        </strong>
                        <span>
                          {selectedRiskStage.items.length > 0
                            ? isVirtualStageSelected || riskItemFilter === "all"
                              ? `${selectedRiskStage.items.length} номенклатур`
                              : `${filteredStageItems.length} из ${selectedRiskStage.items.length} номенклатур`
                            : "на сегодня пусто"}
                        </span>
                      </div>

                      {filteredStageItems.length > 0 ? (
                        <div className={styles.riskSupplierList}>
                          {selectedStageSupplierGroups.map((group) => {
                            const isOpen = openSupplierKeys.has(group.key);
                            const panelId = `risk-supplier-${toDomId(selectedRiskStage.key)}-${toDomId(group.key)}`;

                            return (
                              <div
                                key={group.key}
                                className={`${styles.riskSupplierGroup} ${
                                  isOpen ? styles.riskSupplierGroupOpen : ""
                                }`}
                              >
                                <button
                                  type="button"
                                  id={`${panelId}-toggle`}
                                  className={styles.riskSupplierToggle}
                                  aria-expanded={isOpen}
                                  aria-controls={panelId}
                                  onClick={() => toggleSupplierGroup(group.key)}
                                >
                                  <ChevronDown
                                    className={styles.riskSupplierChevron}
                                    size={16}
                                    strokeWidth={2.2}
                                    aria-hidden="true"
                                  />
                                  <span
                                    className={styles.riskSupplierName}
                                    title={group.label}
                                  >
                                    {group.label}
                                  </span>
                                  <span className={styles.riskSupplierCount}>
                                    {group.items.length} поз.
                                  </span>
                                </button>

                                {isOpen ? (
                                  <ul
                                    id={panelId}
                                    className={styles.riskItemList}
                                    role="region"
                                    aria-labelledby={`${panelId}-toggle`}
                                  >
                                    {group.items.map((item) => (
                                      <li
                                        key={`${selectedRiskStage.key}-${group.key}-${item.nomenclature}-${item.moscowDate}-${item.sheet}`}
                                        className={`${styles.riskItem} ${riskLevelClass(item.riskLevel)}`}
                                        style={
                                          {
                                            "--risk-hue": String(
                                              Math.round((item.riskRatio ?? 0) * 120)
                                            )
                                          } as CSSProperties
                                        }
                                      >
                                        <div className={styles.riskItemMain}>
                                          <strong title={item.nomenclature}>
                                            {item.nomenclature}
                                          </strong>
                                          <span className={styles.riskItemCountdown}>
                                            {formatDaysRemaining(item.daysRemaining)}
                                            {item.windowEnd
                                              ? ` · крайняя дата ${formatRuDate(item.windowEnd)}`
                                              : ""}
                                          </span>
                                        </div>
                                        <div className={styles.riskItemMeta}>
                                          <span
                                            className={styles.riskMeter}
                                            title={`Уровень риска: ${item.riskLevel}, запас по сроку ${(item.riskRatio * 100).toFixed(0)}%`}
                                            aria-hidden="true"
                                          />
                                          <span title={`Количество: ${item.quantity} шт.`}>
                                            <span className={styles.riskItemMetaLabel}>
                                              Кол-во
                                            </span>
                                            {item.quantity.toLocaleString("ru-RU")} шт.
                                          </span>
                                          <span
                                            title={`Примерная дата поставки в Москву: ${formatRuDate(item.moscowDate)}`}
                                          >
                                            <span className={styles.riskItemMetaLabel}>
                                              В Москву
                                            </span>
                                            {formatRuDate(item.moscowDate)}
                                          </span>
                                          <span title={`Лист графика отгрузок: ${item.sheet}`}>
                                            <span className={styles.riskItemMetaLabel}>
                                              Лист
                                            </span>
                                            {item.sheet}
                                          </span>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : selectedRiskStage.items.length > 0 ? (
                        <p className={styles.riskEmptyState}>
                          {riskItemFilter === "at_risk"
                            ? "На этой стадии нет позиций под риском."
                            : riskItemFilter === "on_track"
                              ? "На этой стадии все позиции под риском — успевающих нет."
                              : riskItemFilter === "critical"
                                ? "На этой стадии нет критичных позиций (крайний день / просрочка)."
                                : "Нет позиций по выбранному фильтру."}
                        </p>
                      ) : (
                        <p className={styles.riskEmptyState}>
                          На этой стадии сегодня нет срабатываний.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <AvionDeveloperFeedbackWidget user={user} />
    </div>
  );
}
