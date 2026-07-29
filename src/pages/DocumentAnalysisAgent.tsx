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
  ChevronUp,
  CloudUpload,
  Download,
  FileSearch,
  FileSpreadsheet,
  Loader2,
  Package,
  ShieldCheck,
  Siren,
  Sparkles,
  Trash2,
  Upload
} from "lucide-react";
import {
  documentAnalysisAcceptedExtensions,
  documentAnalysisAgentSubtitle,
  isAcceptedAnalysisFile,
  mockDocumentAnalysisAgent
} from "@/mock-data/documentAnalysisAgent";
import { agentsApi } from "@/api/endpoints";
import styles from "./DocumentAnalysisAgent.module.css";

type FileRoleStatus = "pending" | "loading" | "ready" | "error";

interface StagedFile {
  id: string;
  file: File;
  role: string | null;
  roleStatus: FileRoleStatus;
}

const analysisStages = [
  "Передаём Excel-файлы на backend",
  "Уточняем роли файлов",
  "Извлекаем изделия из графика производства",
  "Сопоставляем изделия со спецификациями",
  "Собираем материалы спецификаций",
  "Подставляем поставщика, цену и остатки",
  "Считаем потребность по месяцам (Заказ / Опытные / Склад × План / Факт)",
  "Считаем ожидаемые поступления из графика отгрузок",
  "Считаем контрольные точки логистики",
  "Считаем прогнозируемый остаток по сумме планов",
  "Считаем обеспечение по дням из детального графика",
  "Считаем обеспеченность изделий по месяцам (сборка из материалов)",
  "Формируем план заказов по месяцам (дата и количество)",
  "Формируем result.xlsx (помесячное, по дням, обеспеченность и план заказов)"
] as const;

/** Файлы в чеклисте до анализа (спеки/цены — на backend в data/aveon). */
const requiredFileRoles = [
  {
    role: "production_schedule",
    label: "График производства",
    hint: "месяцы → Заказ / Опытные / Склад × План / Факт",
    required: true
  },
  {
    role: "detailed_production_schedule",
    label: "Детальный график производства",
    hint: "по дням / неделям → лист «обеспечение по дням»",
    required: false
  },
  {
    role: "stock",
    label: "Остатки",
    hint: "номенклатура и остаток на складе",
    required: true
  },
  {
    role: "shipment_schedule",
    label: "График отгрузок",
    hint: "даты поставок и логистика",
    required: true
  }
] as const;

type ChecklistPanelFace = "files" | "stages";
type RequiredFileRowState = "idle" | "ready" | "missing" | "checking";

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

/** Угол от 12 часов по часовой, в радианах → смещение наружу. */
function doughnutSegmentOffset(
  startShare: number,
  endShare: number,
  distance: number
): { x: number; y: number } {
  if (endShare <= startShare || distance <= 0) {
    return { x: 0, y: 0 };
  }
  const mid = ((startShare + endShare) / 2) * Math.PI * 2;
  return {
    x: Math.sin(mid) * distance,
    y: -Math.cos(mid) * distance
  };
}

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
  const hoverPop = 9;
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

  const onTrackOffset =
    hoveredSegment === "on_track"
      ? doughnutSegmentOffset(0, onTrackShare, hoverPop)
      : { x: 0, y: 0 };
  const atRiskOffset =
    hoveredSegment === "at_risk"
      ? doughnutSegmentOffset(onTrackShare, 1, hoverPop)
      : { x: 0, y: 0 };

  const renderSegment = (
    key: DoughnutSegmentKey,
    startShare: number,
    endShare: number,
    color: string,
    label: string,
    count: number,
    offset: { x: number; y: number }
  ) => {
    if (count <= 0 || endShare <= startShare) return null;
    const isHovered = hoveredSegment === key;
    const isFullRing = endShare - startShare >= 0.999;
    return (
      <g
        key={key}
        className={styles.riskDoughnutSegment}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
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
          onTrack,
          onTrackOffset
        )}
        {renderSegment(
          "at_risk",
          onTrackShare,
          1,
          "var(--color-danger)",
          "Под риском",
          atRisk,
          atRiskOffset
        )}
        <text
          x={centerX}
          y={centerY - 4}
          className={centerValueClass}
          textAnchor="middle"
          dominantBaseline="middle"
          pointerEvents="none"
        >
          {centerPercent}
        </text>
        <text
          x={centerX}
          y={centerY + 14}
          className={styles.riskDoughnutCenterLabel}
          textAnchor="middle"
          dominantBaseline="middle"
          pointerEvents="none"
        >
          {centerLabel}
        </text>
      </svg>
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
  shipment_schedule: "график отгрузок",
  production_schedule: "график производства",
  detailed_production_schedule: "детальный график производства",
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
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Показать файл в проводнике Windows. */
async function openLocalFile(file: File): Promise<void> {
  await agentsApi.revealAveonFileInExplorer(file);
}

type AveonTemplateItem = {
  key: string;
  role: string;
  title: string;
  filename: string;
  description: string;
};

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

export default function DocumentAnalysisAgent() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysisAt, setLastAnalysisAt] = useState<string | null>(null);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [logisticsRisks, setLogisticsRisks] = useState<{
    asOf: string | null;
    stages: LogisticsRiskStageView[];
  } | null>(null);
  const [shiftAssignment, setShiftAssignment] = useState<{
    fileName: string;
    fileBase64: string;
  } | null>(null);
  const [selectedRiskStageKey, setSelectedRiskStageKey] = useState("");
  const [riskItemFilter, setRiskItemFilter] = useState<RiskItemFilter>("all");
  const [flippedRiskTile, setFlippedRiskTile] = useState<RiskItemFilter | null>(null);
  const [virtualRiskFilter, setVirtualRiskFilter] = useState<RiskItemFilter | null>(null);
  const [openSupplierKeys, setOpenSupplierKeys] = useState<Set<string>>(() => new Set());
  const [riskDashboardOpen, setRiskDashboardOpen] = useState(false);
  const [riskPointsOpen, setRiskPointsOpen] = useState(false);
  const riskStageContentRef = useRef<HTMLDivElement>(null);
  const lastRealStageKeyRef = useRef("");
  const [stagesCompact, setStagesCompact] = useState(false);
  const [stagesInlineHidden, setStagesInlineHidden] = useState(false);
  const [stagesOverlayOpen, setStagesOverlayOpen] = useState(false);
  const [rolesSource, setRolesSource] = useState<string | null>(null);
  const [isClassifyingRoles, setIsClassifyingRoles] = useState(false);
  const [checklistFace, setChecklistFace] = useState<ChecklistPanelFace>("files");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<AveonTemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const templatesMenuRef = useRef<HTMLDivElement>(null);
  const stagesSectionRef = useRef<HTMLDivElement>(null);
  const classifyRequestIdRef = useRef(0);
  const classifyAbortRef = useRef<AbortController | null>(null);
  const stagedFilesRef = useRef(stagedFiles);
  const filesFingerprintRef = useRef("");
  const isAnalyzingRef = useRef(false);
  stagedFilesRef.current = stagedFiles;
  isAnalyzingRef.current = isAnalyzing;

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

  const missingRequiredRoles = useMemo(
    () =>
      requiredFileRoles.filter(
        (entry) => entry.required && !presentRequiredRoles.has(entry.role)
      ),
    [presentRequiredRoles]
  );

  const requiredFilesValid = rolesSettled && missingRequiredRoles.length === 0;

  const requiredFileRowStates = useMemo((): Record<string, RequiredFileRowState> => {
    const states: Record<string, RequiredFileRowState> = {};
    for (const entry of requiredFileRoles) {
      if (presentRequiredRoles.has(entry.role)) {
        states[entry.role] = "ready";
      } else if (!stagedFiles.length) {
        states[entry.role] = "idle";
      } else if (!rolesSettled) {
        states[entry.role] = entry.required ? "checking" : "idle";
      } else if (entry.required) {
        states[entry.role] = "missing";
      } else {
        // опциональный детальный график — без красного, если не загружен
        states[entry.role] = "idle";
      }
    }
    return states;
  }, [presentRequiredRoles, rolesSettled, stagedFiles.length]);

  useEffect(() => {
    let cancelled = false;
    void agentsApi
      .getAveonDashboardLatest()
      .then((snapshot) => {
        if (cancelled || !snapshot) return;
        // при повторном заходе — только дашборд; этапы и сменное задание только после нового анализа
        setLogisticsRisks(snapshot.logisticsRisks);
        setLastAnalysisAt(formatAnalysisTimestamp(snapshot.analyzedAt));
      })
      .catch(() => {
        // нет сохранённого дашборда — обычный пустой старт
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void agentsApi
      .listAveonTemplates()
      .then((items) => {
        if (!cancelled) setTemplates(items);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!templatesOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!templatesMenuRef.current?.contains(event.target as Node)) {
        setTemplatesOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTemplatesOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [templatesOpen]);

  const downloadTemplate = useCallback(async (item: AveonTemplateItem) => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const response = await agentsApi.downloadAveonTemplate(item.key);
      downloadBlob(response.data, item.filename);
      setTemplatesOpen(false);
    } catch {
      setTemplatesError("Не удалось скачать шаблон. Проверьте доступ к API.");
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const downloadAllTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const response = await agentsApi.downloadAllAveonTemplatesZip();
      downloadBlob(response.data, "шаблоны_авион.zip");
      setTemplatesOpen(false);
    } catch {
      setTemplatesError("Не удалось скачать архив шаблонов. Проверьте доступ к API.");
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

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
      setChecklistFace("files");
      return;
    }

    // Новые/изменённые файлы → чеклист ролей; дашборд прошлого анализа оставляем до нового прогона
    if (
      previousFingerprint &&
      previousFingerprint !== filesFingerprint &&
      !isAnalyzingRef.current
    ) {
      setChecklistFace("files");
      setStagesCompact(false);
      setStagesInlineHidden(false);
      setStagesOverlayOpen(false);
      setError(null);
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

  const handleAnalyze = useCallback(async () => {
    if (!stagedFiles.length || isAnalyzing || !requiredFilesValid) return;

    classifyAbortRef.current?.abort();
    classifyAbortRef.current = null;
    classifyRequestIdRef.current += 1;
    setIsClassifyingRoles(false);

    setChecklistFace("stages");
    setIsAnalyzing(true);
    setError(null);
    setActiveStageIndex(0);
    setStagesCompact(false);
    setStagesInlineHidden(false);
    setStagesOverlayOpen(false);
    // предыдущий дашборд остаётся на экране до прихода нового результата
    const stageTimer = window.setInterval(() => {
      setActiveStageIndex((current) => Math.min(current + 1, analysisStages.length - 1));
    }, 1200);

    try {
      const result = await agentsApi.analyzeAveonExcel(stagedFiles.map((item) => item.file));

      window.clearInterval(stageTimer);
      setActiveStageIndex(analysisStages.length - 1);
      console.clear();
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
        result.stockFiles.length > 0 ? result.stockFiles.join(", ") : "(файл остатков не найден)";
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
      if (result.shiftAssignmentFileBase64) {
        setShiftAssignment({
          fileName: result.shiftAssignmentFileName,
          fileBase64: result.shiftAssignmentFileBase64
        });
        console.log(
          `Сменное задание готово (скачивание по кнопке): ${result.shiftAssignmentFileName}`
        );
      } else {
        setShiftAssignment(null);
        console.log("сменное задание не сформировано");
      }

      setLogisticsRisks(result.logisticsRisks);
      setRiskDashboardOpen(true);
      setRiskPointsOpen(true);
      setLastAnalysisAt(
        formatAnalysisTimestamp(result.dashboardAnalyzedAt ?? null)
      );
    } catch (caughtError) {
      setError(extractAnalyzeError(caughtError) || "Не удалось выполнить анализ");
      setChecklistFace("files");
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

  const showInlineStages =
    checklistFace === "files" || isAnalyzing || !lastAnalysisAt || !stagesInlineHidden;
  const showStagesCompactBar =
    Boolean(lastAnalysisAt) &&
    !isAnalyzing &&
    stagesInlineHidden &&
    checklistFace === "stages";

  useEffect(() => {
    if (lastAnalysisAt && !isAnalyzing) {
      const collapseTimer = window.setTimeout(() => setStagesCompact(true), 550);
      return () => window.clearTimeout(collapseTimer);
    }
    return undefined;
  }, [lastAnalysisAt, isAnalyzing]);

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

  const renderRequiredFileRows = () =>
    requiredFileRoles.map((entry, index) => {
      const state = requiredFileRowStates[entry.role] ?? "idle";
      const rowClass =
        state === "ready"
          ? styles.stageRowReady
          : state === "missing"
            ? styles.stageRowMissing
            : state === "checking"
              ? styles.stageRowChecking
              : "";
      return (
        <div key={entry.role} className={`${styles.stageRow} ${rowClass}`}>
          <span className={styles.stageDot}>{index + 1}</span>
          <span className={styles.requiredFileRowText}>
            <span className={styles.requiredFileRowLabel}>{entry.label}</span>
            <span className={styles.requiredFileRowHint}>{entry.hint}</span>
          </span>
        </div>
      );
    });

  const renderAnalysisStageRows = () =>
    analysisStages.map((stage, index) => {
      const isCompleted = isAnalyzing ? index < activeStageIndex : Boolean(lastAnalysisAt);
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

  const sessionStatusBadge = (() => {
    if (lastAnalysisAt && checklistFace === "stages") {
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
      return <span className={styles.statusBadge}>Ожидает файлы</span>;
    }
    if (!rolesSettled) {
      return (
        <span className={`${styles.statusBadge} ${styles.statusBadgeProgress}`}>
          Проверяем файлы
        </span>
      );
    }
    if (!requiredFilesValid) {
      return (
        <span className={`${styles.statusBadge} ${styles.statusBadgeDanger}`}>
          Не хватает файлов
        </span>
      );
    }
    return (
      <span className={`${styles.statusBadge} ${styles.statusBadgeSuccess}`}>Готов к анализу</span>
    );
  })();

  return (
    <div className={`${styles.page} ${stagesOverlayOpen ? styles.pageStagesOverlayOpen : ""}`}>
      <Link to="/agents" className={styles.backLink}>
        <ArrowLeft size={16} strokeWidth={2.1} aria-hidden="true" />
        К каталогу агентов
      </Link>

      <header className={styles.hero}>
        <span className={styles.heroBadge}>
          <Sparkles size={14} strokeWidth={2.1} aria-hidden="true" />
          Закупки · Авион
        </span>
        <h1>{mockDocumentAnalysisAgent.name}</h1>
        <p>{documentAnalysisAgentSubtitle}</p>
      </header>

      <div className={styles.workspace}>
        <section className={styles.panel} aria-label="Загрузка файлов">
          <div>
            <h2 className={styles.panelTitle}>Файлы для анализа</h2>
            <p className={styles.panelHint}>
              Перетащите документы в область ниже или выберите их вручную. Поддерживаются {acceptedHint}.
              Нет своих файлов — скачайте шаблоны, заполните и загрузите обратно.
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
            <div className={styles.templatesWrap} ref={templatesMenuRef}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setTemplatesOpen((open) => !open)}
                disabled={templatesLoading}
                aria-expanded={templatesOpen}
                aria-haspopup="menu"
              >
                {templatesLoading ? (
                  <Loader2 size={16} strokeWidth={2.2} aria-hidden="true" className={styles.spin} />
                ) : (
                  <Download size={16} strokeWidth={2.2} aria-hidden="true" />
                )}
                Скачать шаблоны
                <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
              </button>
              {templatesOpen ? (
                <div className={styles.templatesMenu} role="menu">
                  <button
                    type="button"
                    className={styles.templatesMenuItem}
                    role="menuitem"
                    onClick={() => void downloadAllTemplates()}
                    disabled={templatesLoading || !templates.length}
                  >
                    <strong>Все шаблоны (ZIP)</strong>
                    <span>4 файла одним архивом</span>
                  </button>
                  {templates.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={styles.templatesMenuItem}
                      role="menuitem"
                      onClick={() => void downloadTemplate(item)}
                      disabled={templatesLoading}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </button>
                  ))}
                  {!templates.length ? (
                    <p className={styles.templatesMenuEmpty}>Шаблоны пока недоступны на сервере</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleAnalyze}
              disabled={!requiredFilesValid || isAnalyzing}
              title={
                !stagedFiles.length
                  ? "Загрузите обязательные файлы"
                  : !rolesSettled
                    ? "Дождитесь определения ролей"
                    : !requiredFilesValid
                      ? `Не хватает: ${missingRequiredRoles.map((item) => item.label).join(", ")}`
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
                  setStagesCompact(Boolean(lastAnalysisAt));
                  setStagesInlineHidden(Boolean(lastAnalysisAt));
                  setStagesOverlayOpen(false);
                  setRolesSource(null);
                  setIsClassifyingRoles(false);
                  setChecklistFace(lastAnalysisAt ? "stages" : "files");
                }}
                disabled={isAnalyzing}
              >
                Очистить список
              </button>
            ) : null}
          </div>

          {error ? (
            <p className={styles.errorText} role="alert">
              {error}
            </p>
          ) : null}
          {templatesError ? (
            <p className={styles.errorText} role="alert">
              {templatesError}
            </p>
          ) : null}

          {stagedFiles.length ? (
            <p className={styles.rolesHint}>
              {isClassifyingRoles
                ? "Определяем роли файлов…"
                : rolesSource
                  ? `Роли определены (${rolesSource === "lm_studio" ? "LM Studio" : "локально"}) — агент ещё не запущен`
                  : "Роли появятся после распознавания файлов"}
            </p>
          ) : null}

          <div className={styles.fileList}>
            {stagedFiles.length ? (
              stagedFiles.map((item) => {
                const roleLabel = item.role ? (ROLE_LABELS[item.role] ?? item.role) : null;
                return (
                  <article key={item.id} className={styles.fileCard}>
                    <div className={styles.fileIconWrap}>
                      {!isAnalyzing ? (
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
                        aria-label={`Показать в проводнике: ${item.file.name}`}
                        title={`Показать в проводнике: ${item.file.name}`}
                        onClick={() => {
                          void openLocalFile(item.file).catch((error) => {
                            console.error("Не удалось открыть проводник", error);
                            window.alert(
                              "Не удалось открыть проводник. Проверьте, что backend запущен на этой же Windows-машине."
                            );
                          });
                        }}
                      >
                        <span className={styles.fileIcon}>
                          <FileSpreadsheet size={30} strokeWidth={1.8} aria-hidden="true" />
                        </span>
                      </button>
                    </div>
                    <div className={styles.fileMeta}>
                      <button
                        type="button"
                        className={styles.fileNameButton}
                        title={`Показать в проводнике: ${item.file.name}`}
                        onClick={() => {
                          void openLocalFile(item.file).catch((error) => {
                            console.error("Не удалось открыть проводник", error);
                            window.alert(
                              "Не удалось открыть проводник. Проверьте, что backend запущен на этой же Windows-машине."
                            );
                          });
                        }}
                      >
                        <strong>{item.file.name}</strong>
                      </button>
                      <span>{formatBytes(item.file.size)}</span>
                      {item.roleStatus === "loading" || item.roleStatus === "pending" ? (
                        <span className={styles.fileRoleBadgePending}>определяем роль…</span>
                      ) : item.roleStatus === "error" ? (
                        <span className={styles.fileRoleBadgeError}>роль не определена</span>
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
          <h2 className={styles.panelTitle}>Сводка</h2>

          <div className={styles.summaryBlock}>
            <h3 className={styles.summaryBlockTitle}>Текущая сессия</h3>
            <div className={styles.summaryRows}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Файлов в очереди</span>
                <span className={styles.summaryValue}>{stagedFiles.length}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Общий объём</span>
                <span className={styles.summaryValue}>
                  {formatBytes(stagedFiles.reduce((sum, item) => sum + item.file.size, 0))}
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Последний запрос</span>
                <span className={styles.summaryValue}>{lastAnalysisAt ?? "—"}</span>
              </div>
            </div>
          </div>

          {sessionStatusBadge}

          {shiftAssignment ? (
            <div className={styles.shiftAssignmentBlock}>
              <button
                type="button"
                className={styles.shiftAssignmentButton}
                onClick={() =>
                  downloadBase64Excel(
                    shiftAssignment.fileBase64,
                    shiftAssignment.fileName
                  )
                }
              >
                <Download size={18} aria-hidden />
                <span className={styles.shiftAssignmentButtonText}>
                  <span className={styles.shiftAssignmentButtonLabel}>
                    Скачать сменное задание
                  </span>
                  <span className={styles.shiftAssignmentButtonMeta}>
                    для менеджера по закупкам
                  </span>
                </span>
                <FileSpreadsheet size={18} aria-hidden />
              </button>
            </div>
          ) : null}

          <div className={styles.stagesSection} ref={stagesSectionRef}>
            {showInlineStages ? (
              <div
                className={`${styles.stagePanelWrap} ${
                  stagesCompact && lastAnalysisAt && checklistFace === "stages"
                    ? styles.stagePanelWrapCollapsing
                    : ""
                }`}
                onTransitionEnd={handleStagesCollapseTransitionEnd}
              >
                <div className={styles.stagePanelWrapInner}>
                  <div className={styles.flipScene}>
                    <div
                      className={`${styles.flipCard} ${
                        checklistFace === "stages" ? styles.flipCardFlipped : ""
                      }`}
                    >
                      <div
                        className={`${styles.flipFace} ${styles.flipFaceFront}`}
                        aria-hidden={checklistFace !== "files"}
                      >
                        <div
                          className={styles.stagePanel}
                          aria-label="Обязательные файлы для анализа"
                        >
                          {renderRequiredFileRows()}
                        </div>
                      </div>
                      <div
                        className={`${styles.flipFace} ${styles.flipFaceBack}`}
                        aria-hidden={checklistFace !== "stages"}
                      >
                        <div className={styles.stagePanel} aria-label="Этапы анализа">
                          {renderAnalysisStageRows()}
                        </div>
                      </div>
                    </div>
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
              <>
                <button
                  type="button"
                  className={styles.stagesOverlayBackdrop}
                  aria-label="Закрыть этапы анализа"
                  onClick={() => setStagesOverlayOpen(false)}
                />
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
              </>
            ) : null}
          </div>
        </aside>
      </div>

      {logisticsRisks ? (
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
    </div>
  );
}
