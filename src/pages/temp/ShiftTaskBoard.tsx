import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  Loader2,
  Package,
  ShieldCheck,
} from "lucide-react";
import { agentsApi } from "@/api/endpoints";
import type { ShiftAssignmentMeta, ShiftAssignmentPriority, ShiftAssignmentRowKind } from "./shiftAssignmentTypes";
import {
  filterTasksByStatus,
  groupTasksByType,
  parseShiftTasks,
  type ProgressStats,
  type ShiftResultEvalState,
  type ShiftTaskView,
  type TaskItemFilter,
} from "./shiftAssignmentProgress";
import ShiftEvalIndicator from "./ShiftEvalIndicator";
import ShiftEndModal from "./ShiftEndModal";
import ShiftTaskCompleteModal from "./ShiftTaskCompleteModal";
import { evaluateShiftTaskResult, type EvaluateShiftTaskOutcome } from "./evaluateShiftTaskResult";
import styles from "../DocumentAnalysisAgent.module.css";

const VIRTUAL_TASK_PREFIX = "virtual:";

type TaskTileMeta = {
  filter: TaskItemFilter;
  label: string;
  tone: "default" | "danger" | "success" | "critical";
  backTitle: string;
  backRule: string;
  backHint: string;
};

type TaskHorizonFilter = "urgent" | "week";

type HorizonNavItem = {
  key: TaskHorizonFilter;
  label: string;
  description: string;
};

const HORIZON_NAV: HorizonNavItem[] = [
  {
    key: "urgent",
    label: "Срочные",
    description: "Срочно + Сегодня",
  },
  {
    key: "week",
    label: "На неделю",
    description: "Можно начать заранее",
  },
];

const TASK_TILES: TaskTileMeta[] = [
  {
    filter: "all",
    label: "Всего заданий",
    tone: "default",
    backTitle: "Как считается",
    backRule:
      "Все строки сменного задания: логистика (отгрузка, МСК, таможня, Ростов) и необходимые закупки.",
    backHint: "ЛКМ: тип ↔ все задания",
  },
  {
    filter: "active",
    label: "Активные",
    tone: "default",
    backTitle: "Как считается",
    backRule:
      "Задания без проверки результата или с изменённым текстом после последней оценки LM Studio.",
    backHint: "ЛКМ: тип ↔ все активные",
  },
  {
    filter: "resolved",
    label: "Выполнено",
    tone: "success",
    backTitle: "Как считается",
    backRule:
      "LM Studio оценил ответ менеджера как полное выполнение: есть конкретный результат по заданию.",
    backHint: "ЛКМ: тип ↔ все выполненные",
  },
  {
    filter: "attention",
    label: "Не закрыто",
    tone: "danger",
    backTitle: "Как считается",
    backRule:
      "Частично выполненные и невыполненные задания — требуют доработки или повторного контакта.",
    backHint: "ЛКМ: тип ↔ все не закрытые",
  },
];

const VIRTUAL_TASK_LABELS: Partial<Record<TaskItemFilter, string>> = {
  all: "Все задания",
  active: "Активные",
  resolved: "Выполнено",
  partial: "Частично",
  not_resolved: "Не выполнено",
  attention: "Не закрыто",
};

function virtualTaskKey(filter: TaskItemFilter): string {
  return `${VIRTUAL_TASK_PREFIX}${filter}`;
}

function parseVirtualTaskFilter(key: string): TaskItemFilter | null {
  if (!key.startsWith(VIRTUAL_TASK_PREFIX)) return null;
  const filter = key.slice(VIRTUAL_TASK_PREFIX.length);
  if (
    filter === "all" ||
    filter === "active" ||
    filter === "resolved" ||
    filter === "partial" ||
    filter === "not_resolved" ||
    filter === "attention"
  ) {
    return filter;
  }
  return null;
}

function taskTileValue(stats: ProgressStats, filter: TaskItemFilter): number {
  switch (filter) {
    case "active":
      return stats.active;
    case "resolved":
      return stats.resolved;
    case "partial":
      return stats.partial;
    case "not_resolved":
      return stats.notResolved;
    case "attention":
      return stats.partial + stats.notResolved;
    default:
      return stats.total;
  }
}

function taskMatchesHorizon(task: ShiftTaskView, horizon: TaskHorizonFilter): boolean {
  if (horizon === "urgent") {
    return task.priority === "urgent" || task.priority === "today";
  }
  return task.priority === "week";
}

function taskHorizonCount(tasks: ShiftTaskView[], horizon: TaskHorizonFilter): number {
  return tasks.filter((task) => taskMatchesHorizon(task, horizon)).length;
}

function shiftReportDate(meta: ShiftAssignmentMeta | null): string {
  const value = meta?.asOf?.trim();
  const match = value?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeTaskViewProgressStats(tasks: ShiftTaskView[]): ProgressStats {
  const stats: ProgressStats = {
    total: tasks.length,
    active: 0,
    resolved: 0,
    partial: 0,
    notResolved: 0,
    checking: 0,
    resolvedPercent: 0,
    incomplete: 0,
  };

  tasks.forEach((task) => {
    if (task.evalLoading) stats.checking += 1;
    if (task.progressStatus === "resolved") stats.resolved += 1;
    else if (task.progressStatus === "partial") stats.partial += 1;
    else if (task.progressStatus === "not_resolved") stats.notResolved += 1;
    else stats.active += 1;
  });

  stats.incomplete = stats.active + stats.partial + stats.notResolved;
  stats.resolvedPercent = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
  return stats;
}

function priorityLabel(priority: ShiftAssignmentPriority): string {
  switch (priority) {
    case "urgent":
      return "Срочно";
    case "today":
      return "Сегодня";
    default:
      return "Неделя";
  }
}

function taskStatusLabel(status: ShiftTaskView["progressStatus"]): string {
  switch (status) {
    case "resolved":
      return "Выполнено";
    case "partial":
      return "Частично";
    case "not_resolved":
      return "Не выполнено";
    default:
      return "Активно";
  }
}

function taskStatusClass(status: ShiftTaskView["progressStatus"]): string {
  switch (status) {
    case "resolved":
      return styles.taskStatusResolved;
    case "partial":
      return styles.taskStatusPartial;
    case "not_resolved":
      return styles.taskStatusNotResolved;
    default:
      return styles.taskStatusActive;
  }
}

type TaskDoughnutChartProps = {
  resolved: number;
  incomplete: number;
  total: number;
  onSelectFilter?: (filter: TaskItemFilter) => void;
};

function TaskDoughnutChart({ resolved, incomplete, total, onSelectFilter }: TaskDoughnutChartProps) {
  const size = 156;
  const stroke = 16;
  const hoverStroke = 19;
  const pad = 14;
  const radius = (size - stroke) / 2;
  const centerX = size / 2;
  const centerY = size / 2;
  const [hoveredSegment, setHoveredSegment] = useState<"resolved" | "incomplete" | null>(null);

  const resolvedShare = total > 0 ? resolved / total : 0;
  const incompleteShare = total > 0 ? incomplete / total : 0;
  const centerFocus = hoveredSegment ?? "incomplete";
  const centerShare = centerFocus === "resolved" ? resolvedShare : incompleteShare;
  const centerPercent = total > 0 ? `${Math.round(centerShare * 100)}%` : "—";
  const centerLabel = centerFocus === "resolved" ? "выполнено" : "не закрыто";
  const centerValueClass =
    centerFocus === "resolved"
      ? `${styles.riskDoughnutCenterValue} ${styles.riskDoughnutCenterValueSuccess}`
      : `${styles.riskDoughnutCenterValue} ${styles.riskDoughnutCenterValueDanger}`;

  const doughnutArcPath = (cx: number, cy: number, r: number, startShare: number, endShare: number) => {
    const startAngle = startShare * Math.PI * 2 - Math.PI / 2;
    const endAngle = endShare * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = endShare - startShare > 0.5 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const renderSegment = (
    key: "resolved" | "incomplete",
    startShare: number,
    endShare: number,
    color: string,
    label: string,
    count: number,
    filter: TaskItemFilter
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
        onClick={() => onSelectFilter?.(filter)}
        role="button"
        tabIndex={0}
        aria-label={`${label}: ${count}`}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectFilter?.(filter);
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
          aria-labelledby="task-doughnut-title task-doughnut-desc"
          onMouseLeave={() => setHoveredSegment(null)}
        >
          <title id="task-doughnut-title">Доля выполненных заданий</title>
          <desc id="task-doughnut-desc">
            {total > 0
              ? `Выполнено ${resolved} из ${total} заданий (${Math.round(resolvedShare * 100)}%).`
              : "Нет заданий в сменном задании."}
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
            "resolved",
            0,
            resolvedShare,
            "var(--color-success)",
            "Выполнено",
            resolved,
            "resolved"
          )}
          {renderSegment(
            "incomplete",
            resolvedShare,
            1,
            "var(--color-danger)",
            "Не закрыто",
            incomplete,
            "attention"
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
            hoveredSegment === "resolved" ? styles.riskDoughnutLegendItemActive : ""
          }`}
          onClick={() => onSelectFilter?.("resolved")}
          onMouseEnter={() => resolved > 0 && setHoveredSegment("resolved")}
          onMouseLeave={() => setHoveredSegment(null)}
        >
          <span className={`${styles.riskDoughnutSwatch} ${styles.riskDoughnutSwatchSuccess}`} aria-hidden="true" />
          Выполнено
          <strong>{resolved}</strong>
        </button>
        <button
          type="button"
          className={`${styles.riskDoughnutLegendItem} ${
            hoveredSegment === "incomplete" ? styles.riskDoughnutLegendItemActive : ""
          }`}
          onClick={() => onSelectFilter?.("attention")}
          onMouseEnter={() => incomplete > 0 && setHoveredSegment("incomplete")}
          onMouseLeave={() => setHoveredSegment(null)}
        >
          <span className={`${styles.riskDoughnutSwatch} ${styles.riskDoughnutSwatchDanger}`} aria-hidden="true" />
          Не закрыто
          <strong>{incomplete}</strong>
        </button>
      </figcaption>
    </figure>
  );
}

type Props = {
  values: string[][];
  rowPriorities: Array<ShiftAssignmentPriority | null>;
  rowKinds: ShiftAssignmentRowKind[];
  meta: ShiftAssignmentMeta | null;
  resultTexts: Record<string, string>;
  resultEvals: Record<string, ShiftResultEvalState>;
  onResultTextsChange?: Dispatch<SetStateAction<Record<string, string>>>;
  onResultEvalsChange?: Dispatch<SetStateAction<Record<string, ShiftResultEvalState>>>;
  onManagerResultEvaluated?: (
    context: { taskType: string; problem: string; solution: string; nomenclature: string },
    managerResult: string
  ) => Promise<void> | void;
  dashboardOpen: boolean;
  tasksOpen: boolean;
  onDashboardOpenChange: (open: boolean) => void;
  onTasksOpenChange: (open: boolean) => void;
  onOpenShiftModal?: () => void;
  onOpenShipmentModal?: () => void;
  /** Встроен в дашборд обеспеченности (без отдельного заголовка и аккордеонов). */
  embedded?: boolean;
};

export type ShiftTaskBoardProps = Props;

export default function ShiftTaskBoard({
  values,
  rowPriorities,
  rowKinds,
  meta,
  resultTexts,
  resultEvals,
  onResultTextsChange,
  onResultEvalsChange,
  onManagerResultEvaluated,
  dashboardOpen,
  tasksOpen,
  onDashboardOpenChange,
  onTasksOpenChange,
  onOpenShiftModal,
  onOpenShipmentModal,
  embedded = false,
}: Props) {
  const [taskHorizon, setTaskHorizon] = useState<TaskHorizonFilter>("urgent");
  const [taskItemFilter, setTaskItemFilter] = useState<TaskItemFilter>("all");
  const [flippedTaskTile, setFlippedTaskTile] = useState<TaskItemFilter | null>(null);
  const [selectedTaskTypeKey, setSelectedTaskTypeKey] = useState("");
  const [virtualTaskFilter, setVirtualTaskFilter] = useState<TaskItemFilter | null>(null);
  const [activeTask, setActiveTask] = useState<ShiftTaskView | null>(null);
  const [submittingTaskKey, setSubmittingTaskKey] = useState<string | null>(null);
  const [shiftEndOpen, setShiftEndOpen] = useState(false);
  const [shiftEndSubmitting, setShiftEndSubmitting] = useState(false);
  const [shiftEndError, setShiftEndError] = useState<string | null>(null);
  const [shiftEndSuccess, setShiftEndSuccess] = useState<string | null>(null);
  const taskContentRef = useRef<HTMLDivElement>(null);
  const lastRealTaskTypeRef = useRef("");
  const lastEvaluatedRef = useRef<Record<string, string>>({});

  const allTasks = useMemo(
    () => parseShiftTasks(values, rowKinds, rowPriorities, resultTexts, resultEvals),
    [values, rowKinds, rowPriorities, resultTexts, resultEvals]
  );

  const horizonCounts = useMemo(
    () => ({
      urgent: taskHorizonCount(allTasks, "urgent"),
      week: taskHorizonCount(allTasks, "week"),
    }),
    [allTasks]
  );

  const horizonTasks = useMemo(
    () => allTasks.filter((task) => taskMatchesHorizon(task, taskHorizon)),
    [allTasks, taskHorizon]
  );

  const progressStats = useMemo(() => computeTaskViewProgressStats(horizonTasks), [horizonTasks]);

  const todayTasks = useMemo(
    () => allTasks.filter((task) => taskMatchesHorizon(task, "urgent")),
    [allTasks]
  );

  const todayStats = useMemo(() => computeTaskViewProgressStats(todayTasks), [todayTasks]);

  const taskTypeGroups = useMemo(() => groupTasksByType(horizonTasks), [horizonTasks]);

  useEffect(() => {
    if (taskHorizon === "urgent" && horizonCounts.urgent === 0 && horizonCounts.week > 0) {
      setTaskHorizon("week");
    } else if (taskHorizon === "week" && horizonCounts.week === 0 && horizonCounts.urgent > 0) {
      setTaskHorizon("urgent");
    }
  }, [horizonCounts, taskHorizon]);

  useEffect(() => {
    if (!taskTypeGroups.length) {
      setSelectedTaskTypeKey("");
      setTaskItemFilter("all");
      setFlippedTaskTile(null);
      setVirtualTaskFilter(null);
      return;
    }
    const availableKeys = new Set(taskTypeGroups.map((group) => group.key));
    setSelectedTaskTypeKey((current) => {
      if (!current || (!parseVirtualTaskFilter(current) && !availableKeys.has(current))) {
        return taskTypeGroups[0]?.key || "";
      }
      return current;
    });
    setTaskItemFilter("all");
    setFlippedTaskTile(null);
    setVirtualTaskFilter(null);
  }, [taskTypeGroups]);

  const isVirtualTypeSelected = Boolean(parseVirtualTaskFilter(selectedTaskTypeKey));

  const selectedTaskGroup = useMemo(() => {
    const virtualFilter = parseVirtualTaskFilter(selectedTaskTypeKey);
    if (virtualFilter) {
      return {
        key: selectedTaskTypeKey,
        label: VIRTUAL_TASK_LABELS[virtualFilter] ?? "Все задания",
        tasks: filterTasksByStatus(horizonTasks, virtualFilter),
      };
    }
    return taskTypeGroups.find((group) => group.key === selectedTaskTypeKey) ?? null;
  }, [horizonTasks, selectedTaskTypeKey, taskTypeGroups]);

  const filteredTasks = useMemo(() => {
    if (!selectedTaskGroup) return [];
    if (isVirtualTypeSelected) return selectedTaskGroup.tasks;
    return filterTasksByStatus(selectedTaskGroup.tasks, taskItemFilter);
  }, [isVirtualTypeSelected, selectedTaskGroup, taskItemFilter]);

  useEffect(() => {
    if (selectedTaskTypeKey && !parseVirtualTaskFilter(selectedTaskTypeKey)) {
      lastRealTaskTypeRef.current = selectedTaskTypeKey;
    }
  }, [selectedTaskTypeKey]);

  const openVirtualTaskType = useCallback((filter: TaskItemFilter) => {
    setVirtualTaskFilter(filter);
    setTaskItemFilter(filter);
    setSelectedTaskTypeKey(virtualTaskKey(filter));
    window.requestAnimationFrame(() => {
      taskContentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const applyTileFilterToActiveType = useCallback(
    (filter: TaskItemFilter) => {
      setVirtualTaskFilter(null);
      setTaskItemFilter(filter);
      const currentRealKey =
        selectedTaskTypeKey &&
        !parseVirtualTaskFilter(selectedTaskTypeKey) &&
        taskTypeGroups.some((group) => group.key === selectedTaskTypeKey)
          ? selectedTaskTypeKey
          : null;
      const rememberedRealKey =
        lastRealTaskTypeRef.current &&
        taskTypeGroups.some((group) => group.key === lastRealTaskTypeRef.current)
          ? lastRealTaskTypeRef.current
          : null;
      const realKey =
        currentRealKey || rememberedRealKey || taskTypeGroups[0]?.key || "";
      if (realKey) setSelectedTaskTypeKey(realKey);
    },
    [selectedTaskTypeKey, taskTypeGroups]
  );

  const handleTaskTileLeftClick = useCallback(
    (filter: TaskItemFilter) => {
      const onActiveTypeForThisTile =
        !parseVirtualTaskFilter(selectedTaskTypeKey) && taskItemFilter === filter;
      if (onActiveTypeForThisTile) {
        openVirtualTaskType(filter);
      } else {
        applyTileFilterToActiveType(filter);
      }
    },
    [applyTileFilterToActiveType, openVirtualTaskType, selectedTaskTypeKey, taskItemFilter]
  );

  const handleTaskTileRightClick = useCallback(
    (event: ReactMouseEvent, filter: TaskItemFilter) => {
      event.preventDefault();
      event.stopPropagation();
      setFlippedTaskTile((current) => (current === filter ? null : filter));
    },
    []
  );

  const handleTaskTypeBadgeClick = useCallback((typeKey: string) => {
    setFlippedTaskTile(null);
    setTaskItemFilter("all");
    if (!parseVirtualTaskFilter(typeKey)) {
      setVirtualTaskFilter(null);
    }
    setSelectedTaskTypeKey(typeKey);
  }, []);

  const dismissVirtualTaskType = useCallback(() => {
    setVirtualTaskFilter(null);
    setFlippedTaskTile(null);
    if (parseVirtualTaskFilter(selectedTaskTypeKey) && taskTypeGroups.length) {
      setSelectedTaskTypeKey(lastRealTaskTypeRef.current || taskTypeGroups[0]?.key || "");
      setTaskItemFilter("all");
    }
  }, [selectedTaskTypeKey, taskTypeGroups]);

  const handleOpenCompleteModal = useCallback((task: ShiftTaskView) => {
    setActiveTask(task);
  }, []);

  const handleCloseCompleteModal = useCallback(() => {
    if (submittingTaskKey) return;
    setActiveTask(null);
  }, [submittingTaskKey]);

  const handleSubmitTaskResult = useCallback(
    async (text: string): Promise<EvaluateShiftTaskOutcome> => {
      if (!activeTask || !onResultTextsChange || !onResultEvalsChange) {
        return { outcome: "empty" };
      }
      const taskKey = activeTask.key;
      setSubmittingTaskKey(taskKey);
      onResultTextsChange((prev) => ({ ...prev, [taskKey]: text }));
      const outcome = await evaluateShiftTaskResult({
        taskKey,
        context: activeTask,
        text,
        lastEvaluatedRef,
        setResultEvals: onResultEvalsChange,
        currentEval: resultEvals[taskKey],
        onManagerResultEvaluated,
      });
      setSubmittingTaskKey(null);
      return outcome;
    },
    [activeTask, onManagerResultEvaluated, onResultEvalsChange, onResultTextsChange, resultEvals]
  );

  const handleOpenShiftEnd = useCallback(() => {
    setShiftEndError(null);
    setShiftEndSuccess(null);
    setShiftEndOpen(true);
  }, []);

  const handleCloseShiftEnd = useCallback(() => {
    if (shiftEndSubmitting) return;
    setShiftEndOpen(false);
  }, [shiftEndSubmitting]);

  const handleSubmitShiftEnd = useCallback(
    async (reasons: Record<string, string>) => {
      setShiftEndSubmitting(true);
      setShiftEndError(null);
      setShiftEndSuccess(null);
      try {
        const managerName = todayTasks.find((task) => task.manager.trim())?.manager.trim() || "Менеджер";
        const response = await agentsApi.completeShiftAssignment({
          reportDate: shiftReportDate(meta),
          managerName,
          meta: meta
            ? {
                asOf: meta.asOf,
                weekPeriod: meta.weekPeriod,
                weekInPeriod: meta.weekInPeriod,
              }
            : null,
          stats: {
            total: todayStats.total,
            resolved: todayStats.resolved,
            incomplete: todayStats.incomplete,
            partial: todayStats.partial,
            notResolved: todayStats.notResolved,
            active: todayStats.active,
          },
          tasks: todayTasks.map((task) => ({
            key: task.key,
            taskType: task.taskType,
            nomenclature: task.nomenclature,
            problem: task.problem,
            solution: task.solution,
            priority: task.priority,
            deadline: task.deadline,
            deficit: task.deficit,
            status: task.progressStatus,
            resultText: resultTexts[task.key] ?? task.resultText,
            evalComment: resultEvals[task.key]?.comment,
            reason: reasons[task.key],
          })),
          incompleteReasons: reasons,
        });
        setShiftEndSuccess(`Отчёт сохранён и отправлен на ${response.sent_to}.`);
      } catch (err) {
        setShiftEndError(err instanceof Error ? err.message : "Не удалось отправить отчёт");
      } finally {
        setShiftEndSubmitting(false);
      }
    },
    [meta, resultEvals, resultTexts, todayStats, todayTasks]
  );

  const canCompleteTasks = Boolean(onResultTextsChange && onResultEvalsChange);
  const canEndShift = canCompleteTasks && todayTasks.length > 0;
  const showDashboard = embedded || dashboardOpen;
  const showTasks = embedded || tasksOpen;

  if (!allTasks.length) return null;

  const dashboardPanel = (
    <div className={embedded ? styles.coverageEmbeddedTasksSection : styles.riskAccordionPanelInner}>
      <div className={`${styles.riskAnalyticsBlock} ${styles.taskDashboardSummary}`}>
        <div className={styles.riskAnalyticsRow}>
          <div className={styles.taskAnalyticsTiles} role="group" aria-label="Сводка по заданиям">
                  {TASK_TILES.map((tile) => {
                    const isFlipped = flippedTaskTile === tile.filter;
                    const isVirtualActive =
                      virtualTaskFilter === tile.filter &&
                      selectedTaskTypeKey === virtualTaskKey(tile.filter);
                    const isTypeFilterActive =
                      !isVirtualTypeSelected && taskItemFilter === tile.filter;
                    const isTileActive = isVirtualActive || isTypeFilterActive || isFlipped;
                    const toneClass =
                      tile.tone === "danger"
                        ? styles.riskAnalyticsTileDanger
                        : tile.tone === "success"
                          ? styles.riskAnalyticsTileSuccess
                          : "";
                    const iconToneClass =
                      tile.tone === "danger"
                        ? styles.riskAnalyticsTileIconDanger
                        : tile.tone === "success"
                          ? styles.riskAnalyticsTileIconSuccess
                          : "";
                    const Icon =
                      tile.filter === "all"
                        ? Package
                        : tile.filter === "active"
                          ? ClipboardList
                          : tile.filter === "resolved"
                            ? ShieldCheck
                            : AlertTriangle;

                    return (
                      <div
                        key={tile.filter}
                        className={styles.riskTileFlipScene}
                        onContextMenu={(event) => handleTaskTileRightClick(event, tile.filter)}
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
                            aria-pressed={isVirtualActive || isTypeFilterActive}
                            aria-label={`${tile.label}: ${taskTileValue(progressStats, tile.filter)}. ЛКМ — фильтр, ПКМ — сводка`}
                            onClick={() => handleTaskTileLeftClick(tile.filter)}
                            onContextMenu={(event) => handleTaskTileRightClick(event, tile.filter)}
                          >
                            <span className={`${styles.riskAnalyticsTileIcon} ${iconToneClass}`} aria-hidden="true">
                              <Icon size={24} strokeWidth={2} />
                            </span>
                            <span className={styles.riskAnalyticsTileBody}>
                              <span className={styles.riskAnalyticsTileLabel}>{tile.label}</span>
                              <strong className={styles.riskAnalyticsTileValue}>
                                {taskTileValue(progressStats, tile.filter)}
                              </strong>
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`${styles.riskAnalyticsTile} ${styles.riskTileFace} ${styles.riskTileFaceBack} ${toneClass} ${
                              isVirtualActive || isTypeFilterActive ? styles.riskAnalyticsTileActive : ""
                            }`}
                            aria-pressed={isVirtualActive || isTypeFilterActive}
                            aria-label={`${tile.label}: ЛКМ — фильтр, ПКМ — вернуть лицо`}
                            onClick={() => handleTaskTileLeftClick(tile.filter)}
                            onContextMenu={(event) => handleTaskTileRightClick(event, tile.filter)}
                          >
                            <span className={styles.riskTileBackContent}>
                              <span className={styles.riskTileBackTitle}>{tile.backTitle}</span>
                              <span className={styles.riskTileBackRule}>{tile.backRule}</span>
                              <span className={styles.riskTileBackMeta}>
                                Сейчас: {taskTileValue(progressStats, tile.filter)} из {progressStats.total}
                              </span>
                              <span className={styles.riskTileBackHint}>{tile.backHint}</span>
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={styles.riskDoughnutPanel} aria-label="Соотношение выполненных и не закрытых">
                  <TaskDoughnutChart
                    resolved={progressStats.resolved}
                    incomplete={progressStats.incomplete}
                    total={progressStats.total}
                    onSelectFilter={(filter) => {
                      setTaskItemFilter(filter);
                      setFlippedTaskTile(null);
                      if (isVirtualTypeSelected) {
                        setVirtualTaskFilter(null);
                        if (taskTypeGroups.length) {
                          setSelectedTaskTypeKey(
                            lastRealTaskTypeRef.current || taskTypeGroups[0]?.key || ""
                          );
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
    </div>
  );

  const horizonNav = (
    <nav className={styles.taskHorizonNav} aria-label="Горизонт сменного задания">
      {HORIZON_NAV.map((item) => {
        const count = horizonCounts[item.key];
        const isSelected = taskHorizon === item.key;
        const isUrgent = item.key === "urgent";
        return (
          <button
            key={item.key}
            type="button"
            className={`${styles.taskHorizonPill} ${
              isSelected ? styles.taskHorizonPillActive : ""
            } ${isUrgent ? styles.taskHorizonPillUrgent : styles.taskHorizonPillWeek}`}
            aria-pressed={isSelected}
            title={item.description}
            onClick={() => {
              setTaskHorizon(item.key);
              setFlippedTaskTile(null);
              setVirtualTaskFilter(null);
              setTaskItemFilter("all");
            }}
          >
            {item.label}
            <span className={styles.taskHorizonPillCount} aria-label={`${count} заданий`}>
              {count}
            </span>
          </button>
        );
      })}
    </nav>
  );

  const tasksPanel = (
    <div className={embedded ? styles.coverageEmbeddedTasksSection : styles.riskAccordionPanelInner}>
      <div className={styles.riskPointsBody}>
              {embedded ? null : horizonNav}

              <nav className={styles.riskStageNav} aria-label="Типы заданий">
                {taskTypeGroups.map((group, index) => {
                  const isSelected = group.key === selectedTaskTypeKey;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      className={`${styles.riskStageNavBadge} ${
                        isSelected ? styles.riskStageNavBadgeActive : ""
                      } ${styles.riskStageNavBadgeHasItems}`}
                      aria-pressed={isSelected}
                      title={group.label}
                      onClick={() => handleTaskTypeBadgeClick(group.key)}
                    >
                      <span className={styles.riskStageNavIndex}>{index + 1}</span>
                      <span className={styles.riskStageNavLabel}>{group.label}</span>
                      <span className={styles.riskStageNavCount}>{group.tasks.length}</span>
                    </button>
                  );
                })}
                {virtualTaskFilter ? (
                  <div className={styles.riskStageNavVirtualWrap}>
                    <button
                      type="button"
                      className={`${styles.riskStageNavBadge} ${styles.riskStageNavBadgeVirtual} ${
                        selectedTaskTypeKey === virtualTaskKey(virtualTaskFilter)
                          ? styles.riskStageNavBadgeActive
                          : ""
                      } ${styles.riskStageNavBadgeHasItems}`}
                      aria-pressed={selectedTaskTypeKey === virtualTaskKey(virtualTaskFilter)}
                      title={`${VIRTUAL_TASK_LABELS[virtualTaskFilter]} · по всем типам`}
                      onClick={() => handleTaskTypeBadgeClick(virtualTaskKey(virtualTaskFilter))}
                    >
                      <span className={styles.riskStageNavIndex}>{taskTypeGroups.length + 1}</span>
                      <span className={styles.riskStageNavLabel}>
                        {VIRTUAL_TASK_LABELS[virtualTaskFilter]}
                      </span>
                      <span className={styles.riskStageNavCount}>
                        {filterTasksByStatus(horizonTasks, virtualTaskFilter).length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.riskStageNavDismiss}
                      aria-label="Закрыть временный бадж"
                      onClick={dismissVirtualTaskType}
                    >
                      ×
                    </button>
                  </div>
                ) : null}
              </nav>

              {selectedTaskGroup ? (
                <div
                  ref={taskContentRef}
                  className={`${styles.riskStageContent} ${styles.riskStageContentCompact} ${
                    selectedTaskGroup.tasks.length > 0 ? styles.riskStageContentAlert : ""
                  } ${isVirtualTypeSelected ? styles.riskStageContentVirtual : ""}`}
                >
                  <div className={styles.riskStageSummary}>
                    <strong>
                      {isVirtualTypeSelected
                        ? `${selectedTaskGroup.label} · все типы`
                        : selectedTaskGroup.label}
                    </strong>
                    <span>
                      {selectedTaskGroup.tasks.length > 0
                        ? isVirtualTypeSelected || taskItemFilter === "all"
                          ? `${selectedTaskGroup.tasks.length} заданий`
                          : `${filteredTasks.length} из ${selectedTaskGroup.tasks.length} заданий`
                        : "нет заданий"}
                    </span>
                  </div>

                  {filteredTasks.length > 0 ? (
                    <div className={embedded ? styles.coverageEmbeddedTasksScroll : undefined}>
                      <table className={styles.taskTable}>
                        <thead>
                          <tr>
                            <th scope="col">Задание</th>
                            <th scope="col">Срок</th>
                            <th scope="col">Дефицит</th>
                            <th scope="col">
                              <span className={styles.taskTableSrOnly}>Действия</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTasks.map((task) => {
                            const evalState = resultEvals[task.key];
                            const hasResult = Boolean((resultTexts[task.key] ?? task.resultText).trim());
                            const resultPreview = resultTexts[task.key] || task.resultText;
                            return (
                              <tr key={task.key} className={styles.taskTableRow}>
                                <td className={styles.taskTableTaskCell}>
                                  <div className={styles.taskTableTaskMain}>
                                    <span
                                      className={`${styles.taskStatusBadge} ${taskStatusClass(task.progressStatus)} ${styles.taskStatusBadgeCompact}`}
                                    >
                                      {task.evalLoading || evalState?.loading ? (
                                        <>
                                          <Loader2 size={11} className={styles.taskStatusSpinner} aria-hidden />
                                          …
                                        </>
                                      ) : (
                                        taskStatusLabel(task.progressStatus)
                                      )}
                                    </span>
                                    <span
                                      className={styles.taskTableTitle}
                                      title={
                                        hasResult
                                          ? `${task.nomenclature}\n${resultPreview}`
                                          : task.nomenclature
                                      }
                                    >
                                      {task.nomenclature}
                                    </span>
                                    {hasResult ? (
                                      <ShiftEvalIndicator evalState={evalState} size="sm" />
                                    ) : null}
                                  </div>
                                </td>
                                <td className={styles.taskTableDeadlineCell}>
                                  <span className={styles.taskTableDeadline}>
                                    {priorityLabel(task.priority)}
                                    {task.deadline ? ` · ${task.deadline}` : ""}
                                  </span>
                                </td>
                                <td className={styles.taskTableDeficitCell}>
                                  {task.deficit ? (
                                    <span className={styles.taskTableDeficit}>{task.deficit}</span>
                                  ) : (
                                    <span className={styles.taskTableDeficitEmpty}>—</span>
                                  )}
                                </td>
                                <td className={styles.taskTableActionsCell}>
                                  <div className={styles.taskTableActions}>
                                    {canCompleteTasks ? (
                                      <button
                                        type="button"
                                        className={styles.taskTableIconBtn}
                                        aria-label={hasResult ? "Изменить результат" : "Выполнить задание"}
                                        title={hasResult ? "Изменить результат" : "Выполнить"}
                                        onClick={() => handleOpenCompleteModal(task)}
                                      >
                                        <CheckCircle2 size={15} aria-hidden />
                                      </button>
                                    ) : null}
                                    {onOpenShiftModal ? (
                                      <button
                                        type="button"
                                        className={`${styles.taskTableIconBtn} ${styles.taskTableIconBtnGhost}`}
                                        aria-label="Открыть в таблице сменного задания"
                                        title="Таблица"
                                        onClick={onOpenShiftModal}
                                      >
                                        <ExternalLink size={15} aria-hidden />
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : selectedTaskGroup.tasks.length > 0 ? (
                    <p className={styles.riskEmptyState}>Нет заданий по выбранному фильтру.</p>
                  ) : (
                    <p className={styles.riskEmptyState}>В этом типе заданий нет строк.</p>
                  )}
                </div>
              ) : null}
            </div>
    </div>
  );

  const modal = (
    <>
      <ShiftTaskCompleteModal
        open={Boolean(activeTask)}
        task={activeTask}
        resultText={activeTask ? resultTexts[activeTask.key] ?? activeTask.resultText : ""}
        evalState={activeTask ? resultEvals[activeTask.key] : undefined}
        submitting={
          activeTask
            ? submittingTaskKey === activeTask.key || Boolean(resultEvals[activeTask.key]?.loading)
            : false
        }
        onClose={handleCloseCompleteModal}
        onSubmit={handleSubmitTaskResult}
      />
      <ShiftEndModal
        open={shiftEndOpen}
        managerName={todayTasks.find((task) => task.manager.trim())?.manager.trim() || "Менеджер"}
        reportDate={shiftReportDate(meta)}
        meta={meta}
        tasks={todayTasks}
        stats={{
          total: todayStats.total,
          resolved: todayStats.resolved,
          incomplete: todayStats.incomplete,
          partial: todayStats.partial,
          notResolved: todayStats.notResolved,
          active: todayStats.active,
        }}
        submitting={shiftEndSubmitting}
        error={shiftEndError}
        success={shiftEndSuccess}
        onClose={handleCloseShiftEnd}
        onSubmit={handleSubmitShiftEnd}
      />
    </>
  );

  if (embedded) {
    return (
      <div className={styles.coverageEmbeddedTasksRoot} aria-label="Задачи сменного задания">
        <div className={styles.coverageSummaryRow}>
          {canEndShift ? (
            <button
              type="button"
              className={styles.shiftEndButton}
              onClick={handleOpenShiftEnd}
            >
              <CalendarCheck size={14} aria-hidden />
              Завершить смену
            </button>
          ) : null}
          <span className={styles.riskTotalBadge}>
            {meta
              ? `${meta.asOf} · неделя ${meta.weekPeriod} · ${progressStats.total} заданий`
              : `${progressStats.total} заданий`}
          </span>
        </div>
        {dashboardPanel}
        <div className={styles.coverageEmbeddedTasksTypesHeader}>
          <strong>Задания по типам</strong>
          <div className={styles.coverageEmbeddedTasksTypesToolbar}>
            {horizonNav}
            <span className={styles.coverageEmbeddedTasksTypesMeta}>
              {taskHorizon === "urgent" ? "Срочно и сегодня" : "План на неделю"} · {taskTypeGroups.length}{" "}
              типов
            </span>
          </div>
        </div>
        {tasksPanel}
        {modal}
      </div>
    );
  }

  return (
    <section className={styles.riskBoard} aria-label="Задачи сменного задания">
      <div className={styles.riskBoardHeader}>
        <div>
          <h2 className={styles.panelTitle}>Задачи сменного задания</h2>
          <p className={styles.panelHint}>
            {meta
              ? `На ${meta.asOf} · неделя ${meta.weekPeriod}. Переключайте срочные и недельные задания, чтобы закрывать риски по порядку.`
              : "Сменное задание для менеджера по закупкам."}
          </p>
        </div>
        <div className={styles.shiftEndHeaderActions}>
          {canEndShift ? (
            <button
              type="button"
              className={styles.shiftEndButton}
              onClick={handleOpenShiftEnd}
            >
              <CalendarCheck size={14} aria-hidden />
              Завершить смену
            </button>
          ) : null}
          <span className={styles.riskTotalBadge}>
            {progressStats.total > 0 ? `${progressStats.total} заданий` : "Нет заданий"}
          </span>
        </div>
      </div>

      <div className={`${styles.riskAccordion} ${showDashboard ? styles.riskAccordionOpen : ""}`}>
        <button
          type="button"
          className={styles.riskAccordionToggle}
          aria-expanded={showDashboard}
          aria-controls="task-dashboard-panel"
          id="task-dashboard-toggle"
          onClick={() => onDashboardOpenChange(!dashboardOpen)}
        >
          <ChevronDown className={styles.riskAccordionChevron} size={18} strokeWidth={2.2} aria-hidden="true" />
          <span className={styles.riskAccordionMain}>
            <span className={styles.riskAccordionLabel}>Дашборд</span>
            <span className={styles.riskAccordionMeta}>
              Плитки и диаграмма · {taskHorizon === "urgent" ? "срочные" : "на неделю"} ·{" "}
              {progressStats.total > 0 ? `${progressStats.total} заданий` : "без заданий"}
            </span>
          </span>
          <span className={styles.riskAccordionAction}>{showDashboard ? "Скрыть" : "Показать"}</span>
        </button>
        <div
          id="task-dashboard-panel"
          className={styles.riskAccordionPanel}
          role="region"
          aria-labelledby="task-dashboard-toggle"
          aria-hidden={!showDashboard}
          inert={!showDashboard ? true : undefined}
        >
          {dashboardPanel}
        </div>
      </div>

      <div className={`${styles.riskAccordion} ${showTasks ? styles.riskAccordionOpen : ""}`}>
        <button
          type="button"
          className={styles.riskAccordionToggle}
          aria-expanded={showTasks}
          aria-controls="task-types-panel"
          id="task-types-toggle"
          onClick={() => onTasksOpenChange(!tasksOpen)}
        >
          <ChevronDown className={styles.riskAccordionChevron} size={18} strokeWidth={2.2} aria-hidden="true" />
          <span className={styles.riskAccordionMain}>
            <span className={styles.riskAccordionLabel}>Задания по типам</span>
            <span className={styles.riskAccordionMeta}>
              {taskHorizon === "urgent" ? "Срочно и сегодня" : "План на неделю"} ·{" "}
              {taskTypeGroups.length} типов · {progressStats.total} заданий
            </span>
          </span>
          <span className={styles.riskAccordionAction}>{showTasks ? "Скрыть" : "Показать"}</span>
        </button>
        <div
          id="task-types-panel"
          className={styles.riskAccordionPanel}
          role="region"
          aria-labelledby="task-types-toggle"
          aria-hidden={!showTasks}
          inert={!showTasks ? true : undefined}
        >
          {tasksPanel}
        </div>
      </div>

      {modal}
    </section>
  );
}
