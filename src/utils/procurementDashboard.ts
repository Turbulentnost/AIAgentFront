import type {
  ProcurementCaseDetail,
  ProcurementCaseSummary,
  ProcurementRouteStage
} from "@/types/procurement";

export const STATUS_LABELS: Record<string, string> = {
  new: "В работе",
  agent_waiting: "Ожидание ролевого агента",
  data_check: "Проверка данных",
  coverage_check: "Проверка покрытия",
  human_required: "Нужен человек",
  blocked: "Заблокирован",
  closed: "Архив",
  failed: "Ошибка"
};

export const AGENT_WAIT_LABELS: Record<string, string> = {
  waiting_human: "Ожидается действие человека",
  waiting_external: "Ожидается внешнее событие или настройка",
  completed: "Работа агента завершена",
  failed: "Ошибка ролевого агента"
};

export const SYNC_STATUS_LABELS: Record<string, string> = {
  available: "доступен",
  capability_unavailable: "недоступен",
  error: "ошибка чтения",
  unknown: "не проверен"
};

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
}

export function formatQuantity(value: string): string {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return value;
  return quantity.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

export function caseTitle(item: Pick<ProcurementCaseSummary, "source_number" | "source_1c_ref">): string {
  return item.source_number || item.source_1c_ref.slice(0, 8);
}

export function completedStageCount(stages: ProcurementRouteStage[]): number {
  return stages.filter((stage) => stage.status === "completed").length;
}

export function sourceActiveLabel(detail: ProcurementCaseDetail): string {
  if (detail.source_active) return "Актуально в 1С";
  return detail.closed_reason_label || "Не актуально в 1С";
}
