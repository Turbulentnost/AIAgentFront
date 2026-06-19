import type { DepartmentProcessItem, NdTemplateType } from "@/types";

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

export const ND_TEMPLATE_TYPE_LABELS: Record<NdTemplateType, string> = {
  policy: "Политика",
  regulation: "Положение",
  department_regulation: "Положение о подразделении",
  process_regulation: "Регламент",
  sto: "СТО",
  instruction: "Инструкция",
  work_instruction: "Рабочая инструкция",
  job_description: "Должностная инструкция",
  change_notice: "Извещение об изменении",
  document_introduction_order: "Приказ о вводе документа",
  implementation_plan: "План внедрения",
  change_registration_sheet: "Лист регистрации изменений",
  issuance_acknowledgement_sheet: "Лист выдачи и ознакомления",
  training_protocol: "Протокол обучения",
  process_passport: "Паспорт процесса"
};

export const TEMPLATE_CLASSIFICATION_STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает",
  processing: "Классификация",
  completed: "Готово",
  failed: "Ошибка",
  needs_review: "Проверка"
};

export const ND_CHANGE_JOURNAL_EVENT_LABELS: Record<string, string> = {
  document_created: "Документ создан",
  document_updated: "Документ обновлён",
  document_deleted: "Документ удалён",
  template_document_added: "Документ добавлен в шаблон",
  template_document_classified: "Документ шаблона классифицирован",
  department_analysis_started: "Запущен анализ отдела",
  nd_change_request_created: "Создана заявка на изменение",
  nd_change_request_updated: "Заявка на изменение обновлена",
  nd_change_request_completed: "Заявка на изменение завершена",
  nd_change_draft_applied: "Изменение применено к проекту",
  nd_change_notice_generated: "Сформировано извещение",
  nd_control_department_created: "Отдел создан",
  nd_control_department_deleted: "Отдел удалён"
};

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

export const SMK_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  POLICY: "Политика",
  REGULATION: "Положение",
  PROCESS_REGULATION: "Регламент",
  STO: "СТО",
  INSTRUCTION: "Инструкция",
  policy: "Политика",
  regulation: "Положение",
  process_regulation: "Регламент",
  sto: "СТО",
  instruction: "Инструкция"
};

export const SMK_DOCUMENT_LEVEL_LABELS: Record<string, string> = {
  strategic: "Стратегический",
  organizational: "Организационный",
  process: "Процессный",
  technical: "Технический",
  operational: "Операционный"
};

export const SMK_DOCUMENT_TYPE_FILTER_OPTIONS = [
  { value: "", label: "Все типы" },
  { value: "POLICY", label: "Политика" },
  { value: "REGULATION", label: "Положение" },
  { value: "PROCESS_REGULATION", label: "Регламент" },
  { value: "STO", label: "СТО" },
  { value: "INSTRUCTION", label: "Инструкция" }
];

export const SMK_DOCUMENT_LEVEL_FILTER_OPTIONS = [
  { value: "", label: "Все уровни" },
  { value: "strategic", label: "Стратегический" },
  { value: "organizational", label: "Организационный" },
  { value: "process", label: "Процессный" },
  { value: "technical", label: "Технический" },
  { value: "operational", label: "Операционный" }
];

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

export function processHasUmlGraph(process: DepartmentProcessItem): boolean {
  return process.relations_count > 0;
}

export function analysisStatusLabel(status: string | null | undefined): string | null {
  if (!status) return "Не запускался";
  if (status === "pending" || status === "running") return "Анализируется";
  if (status === "cancelled") return "Остановлен";
  if (status === "completed") return "Готово";
  if (status === "completed_with_warnings" || status === "needs_review") return "Требует проверки";
  if (status === "failed") return "Ошибка";
  return null;
}

export function isAnalysisRunning(status: string | null | undefined) {
  return status === "pending" || status === "running";
}
