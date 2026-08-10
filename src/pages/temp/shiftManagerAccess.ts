import type {
  ShiftAssignmentMeta,
  ShiftAssignmentPriority,
  ShiftAssignmentRowKind,
} from "./shiftAssignmentTypes";

export const SHIFT_MANAGER_COLUMN = "Ответственный менеджер";

export const LOCAL_SHIFT_MANAGER_ACCOUNTS = [
  {
    email: "tishchenko.nadezhda@local.dev",
    password: "Tishchenko2026!",
    full_name: "Тищенко Надежда",
    first_name: "Надежда",
    last_name: "Тищенко",
  },
  {
    email: "aksinin.leonid@local.dev",
    password: "Aksinin2026!",
    full_name: "Аксинин Леонид",
    first_name: "Леонид",
    last_name: "Аксинин",
  },
] as const;

type ShiftAssignmentBundle = {
  values: string[][];
  rowPriorities: Array<ShiftAssignmentPriority | null>;
  rowKinds: ShiftAssignmentRowKind[];
  meta: ShiftAssignmentMeta | null;
};

export function resolveShiftManagerScope(
  user: { full_name?: string | null; email?: string | null } | null | undefined
): string | null {
  if (!user) return null;

  const normalizedEmail = user.email?.trim().toLowerCase();
  if (normalizedEmail) {
    const byEmail = LOCAL_SHIFT_MANAGER_ACCOUNTS.find(
      (account) => account.email.toLowerCase() === normalizedEmail
    );
    if (byEmail) return byEmail.full_name;
  }

  const normalizedName = user.full_name?.trim();
  if (normalizedName) {
    const byName = LOCAL_SHIFT_MANAGER_ACCOUNTS.find((account) => account.full_name === normalizedName);
    if (byName) return byName.full_name;
  }

  return null;
}

export function isShiftManagerScoped(
  user: { full_name?: string | null; email?: string | null } | null | undefined
): boolean {
  return resolveShiftManagerScope(user) !== null;
}

function countTaskRows(
  rowKinds: ShiftAssignmentRowKind[],
  rowPriorities: Array<ShiftAssignmentPriority | null>
): Pick<ShiftAssignmentMeta, "taskCount" | "urgentCount" | "todayCount" | "weekCount"> {
  let taskCount = 0;
  let urgentCount = 0;
  let todayCount = 0;
  let weekCount = 0;

  rowKinds.forEach((kind, index) => {
    if (kind !== "task") return;
    taskCount += 1;
    const priority = rowPriorities[index];
    if (priority === "urgent") urgentCount += 1;
    if (priority === "today") todayCount += 1;
    if (priority === "week") weekCount += 1;
  });

  return { taskCount, urgentCount, todayCount, weekCount };
}

export function applyShiftManagerScopeToAssignment<T extends ShiftAssignmentBundle>(
  assignment: T,
  managerName: string
): T {
  if (assignment.values.length <= 1) return assignment;

  const header = assignment.values[0] ?? [];
  const body = assignment.values.slice(1);
  const managerCol = header.findIndex((title) => title === SHIFT_MANAGER_COLUMN);
  if (managerCol < 0) return assignment;

  const filteredBody: string[][] = [];
  const filteredPriorities: Array<ShiftAssignmentPriority | null> = [
    assignment.rowPriorities[0] ?? null,
  ];
  const filteredKinds: ShiftAssignmentRowKind[] = [assignment.rowKinds[0] ?? "header"];

  let pendingGroup: { row: string[]; priority: ShiftAssignmentPriority | null } | null = null;

  const flushGroup = () => {
    if (!pendingGroup) return;
    filteredBody.push(pendingGroup.row);
    filteredPriorities.push(pendingGroup.priority);
    filteredKinds.push("group");
    pendingGroup = null;
  };

  body.forEach((row, index) => {
    const kind = assignment.rowKinds[index + 1] ?? "task";
    const priority = assignment.rowPriorities[index + 1] ?? null;

    if (kind === "group") {
      flushGroup();
      pendingGroup = { row, priority };
      return;
    }

    if (kind !== "task") return;

    const manager = (row[managerCol] ?? "").trim();
    if (manager !== managerName) return;

    if (pendingGroup) flushGroup();

    filteredBody.push(row);
    filteredPriorities.push(priority);
    filteredKinds.push("task");
  });

  flushGroup();

  const rowKinds = filteredKinds;
  const priorityCounts = countTaskRows(rowKinds, filteredPriorities);
  const meta = assignment.meta
    ? {
        ...assignment.meta,
        ...priorityCounts,
      }
    : assignment.meta;

  return {
    ...assignment,
    values: [header, ...filteredBody],
    rowPriorities: filteredPriorities,
    rowKinds,
    meta,
  };
}
