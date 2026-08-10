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
import { AlertTriangle, ChevronDown, CircleHelp, ClipboardList, Layers, Package, ShieldCheck, Siren, X } from "lucide-react";
import styles from "../DocumentAnalysisAgent.module.css";
import ShiftTaskBoard, { type ShiftTaskBoardProps } from "./ShiftTaskBoard";

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
  stats: ManagerCompletionStats;
  tasks: ManagerCompletionTask[];
  incompleteTasks: ManagerCompletionTask[];
  emailSentTo: string;
  emailSentAt: string | null;
};

export type ManagerCompletionDashboard = {
  reportDate: string;
  summary: ManagerCompletionStats;
  managers: ManagerCompletionReport[];
};

export type CoveragePeriodKey = "day" | "week" | "month";
export type CoverageTileKey = "all" | "green" | "yellow" | "red";

export type CoverageMaterialShortage = {
  name: string;
  plan: number;
  stock: number;
  expected: number;
  shortage: number;
};

export type CoverageRow = {
  name: string;
  plan: number;
  fact: number;
  covered: number;
  status: string;
  available?: number;
  shortages?: CoverageMaterialShortage[];
};

export type CoverageSidePayload = {
  rows: CoverageRow[];
  tiles: Record<CoverageTileKey, number> & {
    plan_total?: number;
    fact_total?: number;
    covered_total?: number;
  };
};

export type CoveragePeriodPayload = {
  key: CoveragePeriodKey;
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
  const entity = side === "products" ? "изделий" : "номенклатур";

  switch (tile.key) {
    case "all":
      return {
        title: tile.label,
        shows: `Число ${entity} с планом больше нуля за выбранный период.`,
        counts:
          side === "products"
            ? "План суммируется из детального графика производства по дням периода."
            : "Потребность = план изделий × норма расхода по спецификации."
      };
    case "green":
      return {
        title: tile.label,
        shows: `${side === "products" ? "Изделия" : "Номенклатуры"}, которых хватает на весь план.`,
        counts:
          side === "products"
            ? "Сравниваем план и «Обеспечено»: материалов достаточно, чтобы собрать всё запланированное."
            : "Остаток и поступления за период не меньше потребности."
      };
    case "yellow":
      return {
        title: tile.label,
        shows: `Есть покрытие, но оно меньше плана — ${entity} обеспечены частично.`,
        counts:
          side === "products"
            ? "«Обеспечено» больше нуля, но меньше плана: материалов хватает только на часть партии."
            : "Что-то есть на складе или в пути, но этого меньше, чем требуется."
      };
    case "red":
      return {
        title: tile.label,
        shows: `Нет покрытия или нет данных для расчёта — ${entity} не обеспечены.`,
        counts:
          side === "products"
            ? "«Обеспечено» равно нулю или нет спецификации. Раскройте строку в таблице — увидите, чего не хватает."
            : "На период нет доступного остатка и поступлений."
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

const PERIOD_OPTIONS: Array<{ key: CoveragePeriodKey; label: string }> = [
  { key: "day", label: "За день" },
  { key: "week", label: "За неделю" },
  { key: "month", label: "За месяц" }
];

type CoverageViewTransition = { kind: "period" };

function coverageTransitionClass(transition: CoverageViewTransition | null): string {
  if (!transition) return "";
  return styles.coverageAnimPeriod;
}

const COVERAGE_PERIOD_TRANSITION_MS = 440;

function formatScheduleMonth(value: string): string {
  const [year, month] = value.split("-");
  const monthIndex = Number.parseInt(month ?? "", 10);
  if (!year || monthIndex < 1 || monthIndex > 12) return value;
  const labels = [
    "январь",
    "февраль",
    "март",
    "апрель",
    "май",
    "июнь",
    "июль",
    "август",
    "сентябрь",
    "октябрь",
    "ноябрь",
    "декабрь"
  ];
  return `${labels[monthIndex - 1]} ${year}`;
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
          covered_total: Number(tilesRaw.covered_total ?? 0)
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
            status: String(item.status ?? "")
          };
          if (item.available !== undefined && item.available !== null) {
            mapped.available = Number(item.available);
          }
          if (Array.isArray(item.shortages)) {
            mapped.shortages = item.shortages.flatMap((shortage) => {
              if (!shortage || typeof shortage !== "object") return [];
              const part = shortage as Record<string, unknown>;
              const name = String(part.name ?? "");
              if (!name) return [];
              return [
                {
                  name,
                  plan: Number(part.plan ?? 0),
                  stock: Number(part.stock ?? 0),
                  expected: Number(part.expected ?? 0),
                  shortage: Number(part.shortage ?? 0)
                }
              ];
            });
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

  const defaultPeriod = String(data.default_period ?? "week");
  const normalizedPeriod: CoveragePeriodKey =
    defaultPeriod === "day" || defaultPeriod === "month" ? defaultPeriod : "week";

  return {
    asOf: String(data.as_of ?? ""),
    scheduleMonth: String(data.schedule_month ?? ""),
    defaultPeriod: normalizedPeriod,
    periods
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
  sideLabel: string
): { value: string; subLabel: string } {
  const count = tiles[tileKey] ?? 0;
  if (tileKey === "all") {
    return {
      value: formatCompactQty(tiles.plan_total ?? 0),
      subLabel: `план · ${count} ${sideLabel}`
    };
  }
  return {
    value: String(count),
    subLabel: sideLabel
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

type CoverageDetailTableProps = {
  tile: CoverageTileMeta;
  side: "products" | "nomenclatures";
  rows: CoverageRow[];
  periodLabel: string;
  animateIn?: boolean;
};

function CoverageDetailTable({ tile, side, rows, periodLabel, animateIn = false }: CoverageDetailTableProps) {
  const sideLabel = side === "products" ? "изделия" : "номенклатуры";
  const showAvailable = side === "nomenclatures";
  const expandableProducts =
    side === "products" && (tile.key === "red" || tile.key === "yellow");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  useEffect(() => {
    setExpandedProduct(null);
  }, [tile.key, side, periodLabel, rows]);

  const toggleProduct = useCallback((productName: string) => {
    setExpandedProduct((current) => (current === productName ? null : productName));
  }, []);

  const expandHint = expandableProducts
    ? tile.key === "red"
      ? "Нажмите на изделие, чтобы увидеть недостающие номенклатуры."
      : "Нажмите на изделие, чтобы увидеть, каких материалов не хватает для полного плана."
    : null;

  const detailColumnCount = showAvailable ? 6 : 5;

  return (
    <div
      className={`${styles.coverageDetailBlock} ${animateIn ? styles.coverageDetailAnim : ""}`}
      role="region"
      aria-label={`${tile.label}: ${sideLabel}`}
    >
      <div className={styles.coverageDetailHeader}>
        <div>
          <h3 className={styles.coverageDetailTitle}>
            {tile.label} · {sideLabel}
          </h3>
          <p className={styles.coverageDetailHint}>
            {periodLabel}. {expandHint ?? tile.hint}
          </p>
        </div>
        <span className={styles.riskTotalBadge}>
          {rows.length > 0 ? `${rows.length} поз.` : "Нет позиций"}
        </span>
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
                const isExpanded = expandableProducts && expandedProduct === row.name;
                const canExpand = expandableProducts;
                const shortages = row.shortages ?? [];
                const panelId = `coverage-shortages-${row.name.replace(/[^\w-]+/g, "-")}`;

                return (
                  <Fragment key={row.name}>
                    <tr
                      className={
                        canExpand
                          ? `${styles.coverageDetailRowExpandable} ${
                              isExpanded ? styles.coverageDetailRowExpanded : ""
                            }`
                          : undefined
                      }
                    >
                      <td className={styles.coverageDetailNameCell} title={row.name}>
                        {canExpand ? (
                          <button
                            type="button"
                            className={styles.coverageDetailExpandBtn}
                            aria-expanded={isExpanded}
                            aria-controls={panelId}
                            onClick={() => toggleProduct(row.name)}
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
                          row.name
                        )}
                      </td>
                      <td>{formatQty(row.plan)}</td>
                      <td>{formatQty(row.fact)}</td>
                      <td>{formatQty(row.covered)}</td>
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
                            {shortages.length === 0 ? (
                              <p className={styles.coverageShortageEmpty}>
                                Для этого изделия не найдена спецификация или недостающие
                                номенклатуры не определены.
                              </p>
                            ) : (
                              <>
                                <p className={styles.coverageShortageLead}>
                                  Недостающие номенклатуры для плана {formatQty(row.plan)} за период
                                </p>
                                <table className={styles.coverageShortageTable}>
                                  <thead>
                                    <tr>
                                      <th>Номенклатура</th>
                                      <th>План</th>
                                      <th>Остаток</th>
                                      <th>Ожид. поступление</th>
                                      <th>Не хватает</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {shortages.map((shortage) => (
                                      <tr key={shortage.name}>
                                        <td className={styles.coverageShortageName} title={shortage.name}>
                                          {shortage.name}
                                        </td>
                                        <td>{formatQty(shortage.plan)}</td>
                                        <td>{formatQty(shortage.stock)}</td>
                                        <td>{formatQty(shortage.expected)}</td>
                                        <td
                                          className={
                                            shortage.shortage > 0 ? styles.coverageShortageValue : undefined
                                          }
                                        >
                                          {formatQty(shortage.shortage)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
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
    </div>
  );
}

type CoverageTileExplainPanelProps = {
  tile: CoverageTileMeta;
  side: "products" | "nomenclatures";
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

function ManagerProgressRing({ stats }: { stats: ManagerCompletionStats }) {
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

function ManagerResultsDashboard({ dashboard }: { dashboard: ManagerCompletionDashboard | null }) {
  if (!dashboard) return null;
  const incompleteTasks = dashboard.managers.flatMap((manager) =>
    manager.incompleteTasks.map((task) => ({ manager: manager.managerName, task }))
  );
  const hasData = dashboard.summary.total > 0 || dashboard.managers.length > 0;

  return (
    <section className={styles.managerResultsBoard} aria-label="Результаты работы менеджеров">
      <div className={styles.managerResultsHeader}>
        <div className={styles.coverageModeLead}>
          <span className={styles.coverageModeLeadIcon} aria-hidden="true">
            <ClipboardList size={18} strokeWidth={2.2} />
          </span>
          <div className={styles.coverageModeLeadTextWrap}>
            <h2 className={styles.coverageModeLeadTitle}>Результаты работы менеджеров</h2>
            <p className={styles.coverageModeLeadHint}>
              Общая сводка, сравнение менеджеров и основания по незакрытым заданиям
            </p>
          </div>
        </div>
        <span className={styles.riskTotalBadge}>
          {formatRuDate(dashboard.reportDate)} · {dashboard.summary.total} заданий
        </span>
      </div>

      {!hasData ? (
        <p className={styles.managerResultsEmpty}>
          За выбранный день ещё нет завершённых смен менеджеров.
        </p>
      ) : (
        <>
          <div className={styles.managerResultsSummaryGrid}>
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
            <article className={styles.managerResultsSummaryCard}>
              <span>Общая успеваемость</span>
              <strong>{dashboard.summary.resolvedPercent}%</strong>
            </article>
          </div>

          <div className={styles.managerResultsManagersGrid}>
            {dashboard.managers.map((manager) => (
              <article key={manager.id} className={styles.managerResultCard}>
                <div className={styles.managerResultCardHead}>
                  <div>
                    <p className={styles.managerResultEyebrow}>Менеджер</p>
                    <h3>{manager.managerName}</h3>
                  </div>
                  <ManagerProgressRing stats={manager.stats} />
                </div>
                <div className={styles.managerResultTiles}>
                  <div className={styles.managerResultTile}>
                    <span>Всего</span>
                    <strong>{manager.stats.total}</strong>
                  </div>
                  <div className={styles.managerResultTile}>
                    <span>Выполнено</span>
                    <strong className={styles.managerResultsSuccess}>{manager.stats.resolved}</strong>
                  </div>
                  <div className={styles.managerResultTile}>
                    <span>Не закрыто</span>
                    <strong className={styles.managerResultsDanger}>{manager.stats.incomplete}</strong>
                  </div>
                </div>
                <div className={styles.managerResultBreakdown}>
                  <span>Активно: {manager.stats.active}</span>
                  <span>Частично: {manager.stats.partial}</span>
                  <span>Не выполнено: {manager.stats.notResolved}</span>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.managerResultsReasons}>
            <div className={styles.managerResultsReasonsHead}>
              <h3>Невыполненные задания и основания</h3>
              <span>{incompleteTasks.length}</span>
            </div>
            {incompleteTasks.length > 0 ? (
              <div className={styles.managerResultsReasonList}>
                {incompleteTasks.map(({ manager, task }) => {
                  const title = taskValue(task, "nomenclature") || "Задание";
                  const reason = taskValue(task, "reason") || "Основание не указано";
                  const taskType = taskValue(task, "task_type");
                  const status = taskValue(task, "status");
                  const deadline = taskValue(task, "deadline");
                  return (
                    <article
                      key={`${manager}-${taskValue(task, "key")}-${title}`}
                      className={styles.managerResultsReasonCard}
                    >
                      <div>
                        <p>
                          {manager} · {taskType || "тип не указан"}
                        </p>
                        <strong>{title}</strong>
                        <span>
                          {managerResultStatusLabel(status)}
                          {deadline ? ` · ${deadline}` : ""}
                        </span>
                      </div>
                      <blockquote>{reason}</blockquote>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className={styles.managerResultsEmpty}>Незакрытых заданий с основаниями нет.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

type CoverageDashboardTilesProps = {
  dashboard: CoverageDashboardPayload;
  formatDate?: (iso: string | null | undefined) => string;
  managerTasks?: ShiftTaskBoardProps | null;
  managerResults?: ManagerCompletionDashboard | null;
};

export function CoverageDashboardTiles({
  dashboard,
  formatDate = formatRuDate,
  managerTasks = null,
  managerResults = null
}: CoverageDashboardTilesProps) {
  const hasTasksSide = Boolean(managerTasks);
  const hasManagerResultsSide = Boolean(managerResults);
  const hasExtraSide = hasTasksSide || hasManagerResultsSide;
  const [period, setPeriod] = useState<CoveragePeriodKey>(dashboard.defaultPeriod ?? "week");
  const [selectedTile, setSelectedTile] = useState<CoverageTileKey>("all");
  const [dashboardSide, setDashboardSide] = useState<CoverageDashboardSide>("products");
  const [explainedTile, setExplainedTile] = useState<CoverageTileKey | null>(null);
  const [viewTransition, setViewTransition] = useState<CoverageViewTransition | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const carouselPanelRefs = useRef<Record<CoverageDashboardSide, HTMLDivElement | null>>({
    products: null,
    nomenclatures: null,
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
    },
    []
  );

  useEffect(() => {
    setPeriod(dashboard.defaultPeriod ?? "week");
    setSelectedTile("all");
    setDashboardSide("products");
    setExplainedTile(null);
    setViewTransition(null);
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, [dashboard]);

  useEffect(() => {
    setExplainedTile(null);
  }, [period, dashboardSide]);

  useEffect(() => {
    if (dashboardSide === "tasks" && !hasTasksSide) {
      setDashboardSide("products");
    }
    if (dashboardSide === "manager_results" && !hasManagerResultsSide) {
      setDashboardSide("products");
    }
  }, [dashboardSide, hasManagerResultsSide, hasTasksSide]);

  useEffect(() => {
    if (!hasExtraSide) {
      setCarouselViewportHeight(undefined);
      return undefined;
    }

    const panel = carouselPanelRefs.current[dashboardSide];
    if (!panel) return undefined;

    const updateHeight = () => {
      setCarouselViewportHeight(panel.offsetHeight);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [hasExtraSide, dashboardSide, period, selectedTile, managerTasks, managerResults]);

  useEffect(() => {
    if (!explainedTile) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExplainedTile(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [explainedTile]);

  const periodData = dashboard.periods[period] ?? dashboard.periods.week ?? dashboard.periods.month;
  const isProductsMode = dashboardSide === "products";
  const isNomenclaturesMode = dashboardSide === "nomenclatures";
  const isTasksMode = dashboardSide === "tasks";
  const isManagerResultsMode = dashboardSide === "manager_results";

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

  const toggleTileExplanation = useCallback((tileKey: CoverageTileKey) => {
    setExplainedTile((current) => (current === tileKey ? null : tileKey));
  }, []);

  const handleTileContextMenu = useCallback(
    (event: ReactMouseEvent, tileKey: CoverageTileKey) => {
      event.preventDefault();
      event.stopPropagation();
      toggleTileExplanation(tileKey);
    },
    [toggleTileExplanation]
  );

  const closeTileExplanation = useCallback(() => {
    setExplainedTile(null);
  }, []);

  const handlePeriodChange = useCallback(
    (nextPeriod: CoveragePeriodKey) => {
      if (nextPeriod === period) return;
      scheduleViewTransition({ kind: "period" }, COVERAGE_PERIOD_TRANSITION_MS);
      setPeriod(nextPeriod);
    },
    [period, scheduleViewTransition]
  );

  const selectDashboardSide = useCallback(
    (nextSide: CoverageDashboardSide) => {
      if (nextSide === "tasks" && !hasTasksSide) return;
      if (nextSide === "manager_results" && !hasManagerResultsSide) return;
      if (nextSide === dashboardSide) return;
      setDashboardSide(nextSide);
      setExplainedTile(null);
    },
    [dashboardSide, hasManagerResultsSide, hasTasksSide]
  );

  const periodAnimClassForSide = useCallback(
    (side: "products" | "nomenclatures") =>
      viewTransition?.kind === "period" && dashboardSide === side
        ? coverageTransitionClass(viewTransition)
        : "",
    [dashboardSide, viewTransition]
  );
  const animatingView = viewTransition !== null;
  const scheduleMonthLabel = dashboard.scheduleMonth
    ? formatScheduleMonth(dashboard.scheduleMonth)
    : null;

  if (!periodData) return null;

  const renderSidePanel = (side: "products" | "nomenclatures") => {
    const showNomSide = side === "nomenclatures";
    const sideTilesLocal = showNomSide ? tileValues.nomenclatures : tileValues.products;
    const sideLabelLocal = showNomSide ? "номенклатуры" : "изделия";
    const detailRowsLocal = filterRows(
      showNomSide ? periodData.nomenclatures.rows : periodData.products.rows,
      selectedTileMeta.key
    );

    return (
      <>
        <div className={styles.coverageSummaryRow}>
          <span className={styles.riskTotalBadge}>
            {formatDate(dashboard.asOf)} · {periodData.label} · {periodData.days.length} дн. · план{" "}
            {formatCompactQty(sideTilesLocal.plan_total ?? 0)} · факт{" "}
            {formatCompactQty(sideTilesLocal.fact_total ?? 0)} · обеспечено{" "}
            {formatCompactQty(sideTilesLocal.covered_total ?? 0)}
          </span>
        </div>

        <div className={`${styles.riskAnalyticsBlock} ${styles.coverageSummaryBlock}`}>
          <div className={styles.riskAnalyticsRow}>
            <div className={styles.coverageAnalyticsTiles} role="group" aria-label="Обеспеченность">
              {COVERAGE_TILES.map((tile) => {
                const isSelected = selectedTile === tile.key;
                const isFlipped = explainedTile === tile.key;
                const Icon = tileIcon(tile.key);
                const metric = tileMetricValue(tile.key, sideTilesLocal, sideLabelLocal);

                return (
                  <div
                    key={tile.key}
                    className={styles.riskTileFlipScene}
                    onContextMenu={(event) => handleTileContextMenu(event, tile.key)}
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
                          aria-label={`${tile.label}: ${metric.value}. Выбрать для таблицы`}
                          onClick={() => handleTileClick(tile.key)}
                        >
                          <span
                            className={`${styles.riskAnalyticsTileIcon} ${iconToneClass(tile.tone)}`}
                            aria-hidden="true"
                          >
                            <Icon size={22} strokeWidth={2} />
                          </span>
                          <span className={styles.riskAnalyticsTileBody}>
                            <span className={styles.riskAnalyticsTileLabel}>{tile.label}</span>
                            <strong className={styles.riskAnalyticsTileValue}>{metric.value}</strong>
                            <span className={styles.coverageTileSubLabel}>{metric.subLabel}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.coverageTileInfoBtn} ${
                            isFlipped ? styles.coverageTileInfoBtnActive : ""
                          }`}
                          aria-label={`Подробнее: ${tile.label}`}
                          aria-expanded={isFlipped}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleTileExplanation(tile.key);
                          }}
                          onContextMenu={(event) => handleTileContextMenu(event, tile.key)}
                        >
                          <CircleHelp size={15} strokeWidth={2.2} aria-hidden="true" />
                        </button>
                      </div>

                      <CoverageTileBackFace
                        tile={tile}
                        side={side}
                        onClose={closeTileExplanation}
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
      <div className={styles.coveragePeriodNav} role="tablist" aria-label="Период обеспеченности">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={period === option.key}
            className={`${styles.coveragePeriodBtn} ${
              period === option.key ? styles.coveragePeriodBtnActive : ""
            }`}
            onClick={() => handlePeriodChange(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <span className={styles.coverageToolbarDivider} aria-hidden="true" />
      {dashboardModeSwitch}
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

  return (
    <div className={styles.coverageEmbeddedBlock}>
      <div className={styles.coverageBoardHeader}>
        <div className={styles.coverageBoardIntro}>
          <div
            className={`${styles.coverageModeLead} ${
              isProductsMode
                ? styles.coverageModeLeadProducts
                : isNomenclaturesMode
                  ? styles.coverageModeLeadNom
                  : styles.coverageModeLeadTasks
            }`}
          >
            <span className={styles.coverageModeLeadIcon} aria-hidden="true">
              {isProductsMode ? (
                <Package size={18} strokeWidth={2.2} />
              ) : isNomenclaturesMode ? (
                <Layers size={18} strokeWidth={2.2} />
              ) : (
                <ClipboardList size={18} strokeWidth={2.2} />
              )}
            </span>
            <div className={styles.coverageModeLeadTextWrap}>
              <h2 className={styles.coverageModeLeadTitle}>
                {isProductsMode
                  ? "Обеспеченность производства по изделиям"
                  : isNomenclaturesMode
                    ? "Обеспеченность производства по номенклатурам"
                    : isManagerResultsMode
                      ? "Результаты работы менеджеров"
                      : "Задачи сменного задания"}
              </h2>
              <p className={styles.coverageModeLeadHint}>
                {isProductsMode
                  ? "План, факт и возможность сборки из материалов"
                  : isNomenclaturesMode
                    ? "Потребность, остатки и поступления материалов"
                    : isManagerResultsMode
                      ? "Сводка по выполнению, сравнение менеджеров и основания"
                      : "Срочные и недельные задания менеджера по закупкам"}
                {scheduleMonthLabel && !isTasksMode && !isManagerResultsMode ? ` · ${scheduleMonthLabel}` : ""}
              </p>
            </div>
          </div>
        </div>
        <div className={styles.coverageDashboardControls}>
          {isTasksMode || isManagerResultsMode ? tasksToolbar : periodNav}
        </div>
      </div>

      <div
        className={styles.coverageAnimatedViewport}
        aria-busy={animatingView}
        aria-live="polite"
      >
        {hasExtraSide ? (
          <div
            className={styles.coverageSideCarouselViewport}
            style={carouselViewportHeight ? { height: carouselViewportHeight } : undefined}
          >
            <div
              ref={(node) => {
                carouselPanelRefs.current.products = node;
              }}
              className={`${styles.coverageSideCarouselPanel} ${
                isProductsMode ? "" : styles.coverageSideCarouselPanelHidden
              }`}
            >
              <div key={`products-${period}`} className={periodAnimClassForSide("products")}>
                {renderSidePanel("products")}
              </div>
            </div>
            <div
              ref={(node) => {
                carouselPanelRefs.current.nomenclatures = node;
              }}
              className={`${styles.coverageSideCarouselPanel} ${
                isNomenclaturesMode ? "" : styles.coverageSideCarouselPanelHidden
              }`}
            >
              <div key={`nomenclatures-${period}`} className={periodAnimClassForSide("nomenclatures")}>
                {renderSidePanel("nomenclatures")}
              </div>
            </div>
            <div
              ref={(node) => {
                carouselPanelRefs.current.tasks = node;
              }}
              className={`${styles.coverageSideCarouselPanel} ${
                isTasksMode ? "" : styles.coverageSideCarouselPanelHidden
              }`}
            >
              <div key="tasks-panel" className={isTasksMode ? styles.coverageAnimFade : ""}>
                {managerTasks ? <ShiftTaskBoard embedded {...managerTasks} /> : null}
              </div>
            </div>
            <div
              ref={(node) => {
                carouselPanelRefs.current.manager_results = node;
              }}
              className={`${styles.coverageSideCarouselPanel} ${
                isManagerResultsMode ? "" : styles.coverageSideCarouselPanelHidden
              }`}
            >
              <div key="manager-results-panel" className={isManagerResultsMode ? styles.coverageAnimFade : ""}>
                <ManagerResultsDashboard dashboard={managerResults} />
              </div>
            </div>
          </div>
        ) : (
          <div className={`${styles.riskTileFlipScene} ${styles.coverageSideFlipScene}`}>
            <div
              className={`${styles.riskTileFlipCard} ${styles.coverageSideFlipCard} ${
                isNomenclaturesMode ? styles.riskTileFlipCardFlipped : ""
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
        )}
      </div>
    </div>
  );
}

type CoverageDashboardProps = {
  dashboard: CoverageDashboardPayload | null;
  formatDate?: (iso: string | null | undefined) => string;
  managerTasks?: ShiftTaskBoardProps | null;
  managerResults?: ManagerCompletionDashboard | null;
};

export function CoverageDashboard({
  dashboard,
  formatDate = formatRuDate,
  managerTasks = null,
  managerResults = null
}: CoverageDashboardProps) {
  if (!dashboard) return null;

  return (
    <section className={styles.coverageBoard} aria-label="Обеспеченность производства">
      <CoverageDashboardTiles
        dashboard={dashboard}
        formatDate={formatDate}
        managerTasks={managerTasks}
        managerResults={managerResults}
      />
    </section>
  );
}

export { mapCoverageDashboard };
