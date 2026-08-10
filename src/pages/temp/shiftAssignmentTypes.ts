export type ShiftAssignmentPriority = "urgent" | "today" | "week";
export type ShiftAssignmentRowKind = "header" | "group" | "task" | "empty";

export type ShiftAssignmentMeta = {
  asOf: string;
  weekPeriod: string;
  weekInPeriod: boolean;
  taskCount: number;
  urgentCount: number;
  todayCount: number;
  weekCount: number;
};
