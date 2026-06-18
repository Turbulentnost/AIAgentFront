export interface DailySummaryRow {
  id: string;
  indicator: string;
  quantity: number | string;
  note: string;
}

export interface ControlRegisterRow {
  id: string;
  documentNumber: string;
  date: string;
  task: string;
  assignee: string;
  department: string;
  dueDate: string;
  status: string;
  artifact: string;
  overdueDays: number | string;
  overdueReason: string;
  postponementRequest: string;
  postponementBasis: string;
  controllerAction: string;
  rkRequired: string;
}

export const dailySummaryIndicators: DailySummaryRow[] = [
  { id: "total", indicator: "Всего задач на контроле", quantity: 0, note: "" },
  { id: "new", indicator: "Новые задачи за день", quantity: 0, note: "" },
  { id: "due_today", indicator: "Задачи со сроком сегодня", quantity: 0, note: "" },
  {
    id: "due_soon",
    indicator: "Задачи со сроком в ближайшие 1–3 рабочих дня",
    quantity: 0,
    note: ""
  },
  { id: "overdue", indicator: "Просроченные задачи", quantity: 0, note: "" },
  { id: "critical", indicator: "Критические просрочки", quantity: 0, note: "" },
  { id: "done_no_artifact", indicator: "Выполненные задачи без артефакта", quantity: 0, note: "" },
  {
    id: "done_no_confirm",
    indicator: "Выполненные задачи без подтверждения",
    quantity: 0,
    note: ""
  },
  { id: "postpone_requested", indicator: "Запрошен перенос срока", quantity: 0, note: "" },
  { id: "postpone_approved", indicator: "Перенос согласован", quantity: 0, note: "" },
  { id: "postpone_unfounded", indicator: "Перенос без основания", quantity: 0, note: "" },
  { id: "rk_issues", indicator: "Вопросы для вынесения на РК", quantity: 0, note: "" },
  { id: "closed_today", indicator: "Задачи закрыты за день", quantity: 0, note: "" }
];

export const controlRegisterRows: ControlRegisterRow[] = [];
