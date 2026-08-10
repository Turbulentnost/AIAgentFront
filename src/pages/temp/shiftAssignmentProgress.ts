import type { ShiftAssignmentPriority, ShiftAssignmentRowKind } from "./shiftAssignmentTypes";

export type ResultEvalStatus = "resolved" | "partial" | "not_resolved";

export type ShiftResultEvalState = {
  status?: ResultEvalStatus;
  comment?: string;
  loading?: boolean;
  error?: string;
};

export type TaskProgressStatus = "active" | "resolved" | "partial" | "not_resolved";

export type TaskItemFilter = "all" | "active" | "resolved" | "partial" | "not_resolved" | "attention";

export type ProgressStats = {
  total: number;
  active: number;
  resolved: number;
  partial: number;
  notResolved: number;
  checking: number;
  resolvedPercent: number;
  incomplete: number;
};

export type ShiftTaskContext = {
  taskType: string;
  problem: string;
  solution: string;
  nomenclature: string;
};

export type ShiftTaskView = ShiftTaskContext & {
  key: string;
  taskType: string;
  priority: ShiftAssignmentPriority;
  deficit: string;
  country: string;
  supplier: string;
  deadline: string;
  manager: string;
  resultText: string;
  progressStatus: TaskProgressStatus;
  evalComment?: string;
  evalLoading?: boolean;
  evalError?: string;
};

export type ShiftTaskTypeGroup = {
  key: string;
  label: string;
  tasks: ShiftTaskView[];
};

export const RESULT_COLUMN_HEADER = "Результат работы менеджера";

export const TASK_TYPE_ORDER: Record<string, number> = {
  Отгрузка: 0,
  "Логистика МСК": 1,
  Таможня: 2,
  "Логистика Ростов": 3,
  "Необходимые закупки": 4,
};

export function buildColIndexByHeader(header: string[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((title, index) => map.set(title, index));
  return map;
}

export function buildTaskKey(context: ShiftTaskContext): string {
  return [
    context.taskType,
    context.nomenclature,
    context.problem.slice(0, 120),
    context.solution.slice(0, 80),
  ].join("::");
}

export function buildTaskTypesByRow(body: string[][], rowKinds: ShiftAssignmentRowKind[]): string[] {
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

export function buildTaskContextFromRow(
  row: string[],
  taskType: string,
  colIndexByHeader: Map<string, number>
): ShiftTaskContext {
  return {
    taskType,
    problem: row[colIndexByHeader.get("Проблема") ?? -1] ?? "",
    solution: row[colIndexByHeader.get("Что сделать") ?? -1] ?? "",
    nomenclature: row[colIndexByHeader.get("Номенклатура") ?? -1] ?? "",
  };
}

export function getTaskProgressStatus(
  taskKey: string,
  resultEvals: Record<string, ShiftResultEvalState>
): TaskProgressStatus {
  const evalState = resultEvals[taskKey];
  if (evalState?.loading) return "active";
  if (evalState?.status === "resolved") return "resolved";
  if (evalState?.status === "partial") return "partial";
  if (evalState?.status === "not_resolved") return "not_resolved";
  return "active";
}

export function computeProgressStats(
  body: string[][],
  rowKinds: ShiftAssignmentRowKind[],
  resultEvals: Record<string, ShiftResultEvalState>,
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
    incomplete: 0,
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

  stats.incomplete = stats.partial + stats.notResolved + stats.active;
  stats.resolvedPercent =
    stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
  return stats;
}

export function buildInitialResultTexts(
  body: string[][],
  rowKinds: ShiftAssignmentRowKind[],
  colIndexByHeader: Map<string, number>
): Record<string, string> {
  const taskTypes = buildTaskTypesByRow(body, rowKinds);
  const resultColIndex = colIndexByHeader.get(RESULT_COLUMN_HEADER) ?? -1;
  const texts: Record<string, string> = {};

  if (resultColIndex < 0) return texts;

  body.forEach((row, index) => {
    if ((rowKinds[index] ?? "task") !== "task") return;
    const context = buildTaskContextFromRow(row, taskTypes[index] ?? "", colIndexByHeader);
    texts[buildTaskKey(context)] = row[resultColIndex] ?? "";
  });

  return texts;
}

export function filterTasksByStatus(tasks: ShiftTaskView[], filter: TaskItemFilter): ShiftTaskView[] {
  switch (filter) {
    case "active":
      return tasks.filter((task) => task.progressStatus === "active");
    case "resolved":
      return tasks.filter((task) => task.progressStatus === "resolved");
    case "partial":
      return tasks.filter((task) => task.progressStatus === "partial");
    case "not_resolved":
      return tasks.filter((task) => task.progressStatus === "not_resolved");
    case "attention":
      return tasks.filter(
        (task) => task.progressStatus === "partial" || task.progressStatus === "not_resolved"
      );
    default:
      return tasks;
  }
}

export function parseShiftTasks(
  values: string[][],
  rowKinds: ShiftAssignmentRowKind[],
  rowPriorities: Array<ShiftAssignmentPriority | null>,
  resultTexts: Record<string, string>,
  resultEvals: Record<string, ShiftResultEvalState>
): ShiftTaskView[] {
  if (values.length <= 1) return [];

  const header = values[0] ?? [];
  const body = values.slice(1);
  const bodyKinds = rowKinds.slice(1);
  const bodyPriorities = rowPriorities.slice(1);
  const colIndexByHeader = buildColIndexByHeader(header);
  const taskTypes = buildTaskTypesByRow(body, bodyKinds);
  const tasks: ShiftTaskView[] = [];

  body.forEach((row, index) => {
    if ((bodyKinds[index] ?? "task") !== "task") return;

    const context = buildTaskContextFromRow(row, taskTypes[index] ?? "", colIndexByHeader);
    const key = buildTaskKey(context);
    const evalState = resultEvals[key] ?? {};
    const progressStatus = getTaskProgressStatus(key, resultEvals);

    tasks.push({
      ...context,
      key,
      priority: bodyPriorities[index] ?? "week",
      deficit: row[colIndexByHeader.get("Дефицит") ?? -1] ?? "",
      country: row[colIndexByHeader.get("Страна") ?? -1] ?? "",
      supplier: row[colIndexByHeader.get("Поставщик") ?? -1] ?? "",
      deadline: row[colIndexByHeader.get("Крайний срок") ?? -1] ?? "",
      manager: row[colIndexByHeader.get("Ответственный менеджер") ?? -1] ?? "",
      resultText: resultTexts[key] ?? row[colIndexByHeader.get(RESULT_COLUMN_HEADER) ?? -1] ?? "",
      progressStatus,
      evalComment: evalState.comment,
      evalLoading: evalState.loading,
      evalError: evalState.error,
    });
  });

  return tasks;
}

export function groupTasksByType(tasks: ShiftTaskView[]): ShiftTaskTypeGroup[] {
  const grouped = new Map<string, ShiftTaskView[]>();
  for (const task of tasks) {
    const label = task.taskType || "Прочие";
    const bucket = grouped.get(label) ?? [];
    bucket.push(task);
    grouped.set(label, bucket);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => {
      const leftOrder = TASK_TYPE_ORDER[left] ?? 99;
      const rightOrder = TASK_TYPE_ORDER[right] ?? 99;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.localeCompare(right, "ru");
    })
    .map(([label, groupTasks]) => ({
      key: label,
      label,
      tasks: groupTasks,
    }));
}

export function sortTaskTypes(types: string[]): string[] {
  return [...types].sort((left, right) => {
    const leftOrder = TASK_TYPE_ORDER[left] ?? 99;
    const rightOrder = TASK_TYPE_ORDER[right] ?? 99;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.localeCompare(right, "ru");
  });
}
