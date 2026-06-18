import type { ExportColumn } from "@/utils/exportTableToExcel";
import type { PorucheniyaTableColumn, TasksDashboardRead } from "@/types/porucheniya";
const COLUMN_TITLE_OVERRIDES: Record<string, string> = {
  document_number: "Номер",
  task_text: "Задача"
};

const HIDDEN_COLUMN_KEYS = new Set(["source"]);

export function getRegisterColumns(columns: PorucheniyaTableColumn[]): ExportColumn[] {
  return columns
    .filter((column) => !HIDDEN_COLUMN_KEYS.has(column.key))
    .map((column) => ({
      key: column.key,
      title: COLUMN_TITLE_OVERRIDES[column.key] ?? column.title
    }));
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
