export type DepartmentTab =
  | "overview"
  | "documents"
  | "processes"
  | "relations"
  | "review"
  | "history";

export const DEPARTMENT_TABS: { id: DepartmentTab; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "documents", label: "Документы" },
  { id: "processes", label: "Процессы" },
  { id: "relations", label: "Связи" },
  { id: "review", label: "Требует проверки" },
  { id: "history", label: "История анализа" }
];

export const ANALYSIS_STEP_LABELS: Record<string, string> = {
  initializing: "Инициализация анализа",
  loading_knowledge_bases: "Загружаем базы знаний отдела",
  extracting_document_cards: "Извлекаем карточки документов",
  building_department_profile: "Строим профиль отдела",
  building_relations: "Формируем процессы и связи",
  completed: "Завершаем анализ",
  failed: "Ошибка анализа"
};

export const EXTRACTION_STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает",
  processing: "Обработка",
  completed: "Готово",
  failed: "Ошибка",
  needs_review: "Проверка"
};

export const KB_STATUS_LABELS: Record<string, string> = {
  empty: "Пусто",
  pending: "Не обработано",
  partial: "Частично",
  ready: "Готово",
  error: "Ошибки"
};

export const CONFIDENCE_LABELS: Record<string, string> = {
  high: "Высокая",
  medium: "Средняя",
  low: "Низкая"
};

export const EXTRACTION_TYPE_LABELS: Record<string, string> = {
  explicit: "Явно из документа",
  inferred: "Вывод агента",
  uncertain: "Требует проверки"
};

export const CONFIRMATION_LABELS: Record<string, string> = {
  confirmed: "Подтверждено",
  pending: "Не подтверждено",
  rejected: "Отклонено"
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: "На проверке",
  approved: "Подтверждено",
  rejected: "Отклонено"
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  Document: "Документ",
  Process: "Процесс",
  Department: "Отдел",
  Role: "Роль",
  Form: "Форма",
  System: "Система",
  Resource: "Ресурс"
};

export const RELATION_TYPE_LABELS: Record<string, string> = {
  DEPARTMENT_OWNS_PROCESS: "Отдел владеет процессом",
  DEPARTMENT_PARTICIPATES_IN_PROCESS: "Отдел участвует в процессе",
  DOCUMENT_REGULATES_PROCESS: "Документ регулирует процесс",
  PROCESS_USES_FORM: "Процесс использует форму",
  PROCESS_USES_SYSTEM: "Процесс использует систему",
  PROCESS_HAS_ROLE: "В процессе есть роль",
  ROLE_RESPONSIBLE_FOR_ACTION: "Роль отвечает за действие"
};

export function analysisStatusLabel(status: string | null | undefined): string | null {
  if (!status) return "Не запускался";
  if (status === "pending" || status === "running") return "Анализируется";
  if (status === "completed") return "Готово";
  if (status === "completed_with_warnings" || status === "needs_review") return "Требует проверки";
  if (status === "failed") return "Ошибка";
  return null;
}

export function isAnalysisRunning(status: string | null | undefined) {
  return status === "pending" || status === "running";
}
