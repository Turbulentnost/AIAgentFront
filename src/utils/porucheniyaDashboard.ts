import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  ClipboardCheck,
  Clock3
} from "lucide-react";
import type { ExportColumn } from "@/utils/exportTableToExcel";
import type { PorucheniyaTableColumn, TasksDashboardRead } from "@/types/porucheniya";

const COLUMN_TITLE_OVERRIDES: Record<string, string> = {
  document_number: "Номер",
  task_text: "Задача"
};

const HIDDEN_COLUMN_KEYS = new Set(["source"]);

export type ParticipantRole = "executor" | "reviewer" | "department";

export type RegisterTableColumn =
  | { type: "data"; key: string; title: string }
  | { type: "participants"; key: "__participants__"; title: string }
  | { type: "status"; key: string; title: string }
  | { type: "collapsible"; key: string; title: string; minWidth: number }
  | { type: "toggle"; key: "__toggle__"; title: string };

export interface RegisterParticipantKeys {
  executor?: string;
  reviewer?: string;
  department?: string;
}

export interface RegisterTableLayout {
  columns: RegisterTableColumn[];
  participantKeys: RegisterParticipantKeys;
}

export interface TaskStatusVisual {
  Icon: LucideIcon;
  tone: "done" | "overdue" | "review" | "pending" | "progress" | "default";
  label: string;
}

export function getRegisterColumns(columns: PorucheniyaTableColumn[]): ExportColumn[] {
  return columns
    .filter((column) => !HIDDEN_COLUMN_KEYS.has(column.key))
    .map((column) => ({
      key: column.key,
      title: COLUMN_TITLE_OVERRIDES[column.key] ?? column.title
    }));
}

function normalizeColumnLabel(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectParticipantRole(column: ExportColumn): ParticipantRole | null {
  const key = column.key.toLowerCase();
  const title = normalizeColumnLabel(column.title);

  if (
    key.includes("executor") ||
    key.includes("assignee") ||
    key.includes("ispoln") ||
    title.includes("исполнитель")
  ) {
    return "executor";
  }

  if (
    key.includes("reviewer") ||
    key.includes("checker") ||
    key.includes("prover") ||
    title.includes("проверяющ")
  ) {
    return "reviewer";
  }

  if (
    key.includes("department") ||
    key.includes("podrazd") ||
    key.includes("subdivision") ||
    title.includes("подраздел")
  ) {
    return "department";
  }

  return null;
}

export function isCollapsibleRegisterColumn(column: ExportColumn): boolean {
  const key = column.key.toLowerCase();
  const title = normalizeColumnLabel(column.title);

  return (
    title.includes("просроч") ||
    title.includes("перенос") ||
    title.includes("контролер") ||
    title.includes("требуется рк") ||
    key.includes("overdue") ||
    key.includes("delay") ||
    key.includes("postpone") ||
    key.includes("transfer") ||
    key.includes("controller") ||
    key.includes("rk_required")
  );
}

function isStatusRegisterColumn(column: ExportColumn): boolean {
  const key = column.key.toLowerCase();
  const title = normalizeColumnLabel(column.title);
  return key.includes("status") || title === "статус" || title.startsWith("статус ");
}

function getCollapsibleMinWidth(column: ExportColumn): number {
  const title = normalizeColumnLabel(column.title);
  if (title.includes("основание") || title.includes("причина") || title.includes("действие")) {
    return 200;
  }
  if (title.includes("просроч")) return 108;
  if (title.includes("требуется")) return 112;
  return 152;
}

export function buildRegisterTableLayout(columns: ExportColumn[]): RegisterTableLayout {
  const participantKeys: RegisterParticipantKeys = {};
  const output: RegisterTableColumn[] = [];
  const collapsible: RegisterTableColumn[] = [];
  let participantColumnAdded = false;

  for (const column of columns) {
    const participantRole = detectParticipantRole(column);
    if (participantRole) {
      participantKeys[participantRole] = column.key;
      if (!participantColumnAdded) {
        output.push({ type: "participants", key: "__participants__", title: "Участники" });
        participantColumnAdded = true;
      }
      continue;
    }

    if (isCollapsibleRegisterColumn(column)) {
      collapsible.push({
        type: "collapsible",
        key: column.key,
        title: column.title,
        minWidth: getCollapsibleMinWidth(column)
      });
      continue;
    }

    if (isStatusRegisterColumn(column)) {
      output.push({ type: "status", key: column.key, title: column.title });
      continue;
    }

    output.push({ type: "data", key: column.key, title: column.title });
  }

  if (collapsible.length) {
    output.push(...collapsible);
    output.push({ type: "toggle", key: "__toggle__", title: "" });
  }

  return { columns: output, participantKeys };
}

export function formatPersonShortFio(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") return "—";

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];

  const [lastName, ...rest] = parts;
  const initials = rest.map((part) => `${part.charAt(0).toUpperCase()}.`).join(" ");
  return `${lastName} ${initials}`.trim();
}

export function getTaskStatusVisual(status: string): TaskStatusVisual {
  const normalized = status.toLowerCase().replace(/\s+/g, "");

  if (
    normalized.includes("выполн") ||
    normalized.includes("заверш") ||
    normalized.includes("закрыт") ||
    normalized.includes("done")
  ) {
    return { Icon: CheckCircle2, tone: "done", label: status };
  }

  if (normalized.includes("просроч") || normalized.includes("overdue")) {
    return { Icon: AlertTriangle, tone: "overdue", label: status };
  }

  if (normalized.includes("провер") || normalized.includes("review")) {
    return { Icon: ClipboardCheck, tone: "review", label: status };
  }

  if (normalized.includes("ожид") || normalized.includes("план") || normalized.includes("pending")) {
    return { Icon: CircleDashed, tone: "pending", label: status };
  }

  if (normalized.includes("исполн") || normalized.includes("работ") || normalized.includes("progress")) {
    return { Icon: Clock3, tone: "progress", label: status };
  }

  return { Icon: CircleDot, tone: "default", label: status };
}

export function formatMetricsNote(note: string | null | undefined): string {
  if (note === null || note === undefined || note === "") return "—";
  return note;
}

export function buildRegisterEmptyMessage(dashboard: TasksDashboardRead): string {
  const period = formatPorucheniyaPeriod(dashboard.period_start, dashboard.period_end);
  const base = `За ${period} по руководителю «${dashboard.author_fio}» задач не найдено.`;

  if (dashboard.counts.total_tasks === 0 && dashboard.summary) {
    return `${base} ${dashboard.summary}. Отбор идёт по полю «Руководитель» в документе 1С (дата документа, не срок задачи).`;
  }

  return `${base} Отбор идёт по полю «Руководитель» в документе 1С (дата документа, не срок задачи).`;
}

export function formatPorucheniyaPeriod(start: string, end: string): string {
  if (start === end) return formatPorucheniyaDate(start);
  return `${formatPorucheniyaDate(start)} — ${formatPorucheniyaDate(end)}`;
}

export function formatPorucheniyaDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function formatPorucheniyaDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function getRegisterCellValue(row: Record<string, string | number>, key: string): string {
  const value = row[key];
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
