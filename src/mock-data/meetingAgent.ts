export type MeetingQueueTab = "all" | "ud" | "today" | "conflicts" | "errors";

export interface MeetingStat {
  id: string;
  label: string;
  value: number;
  tone: "blue" | "violet" | "amber" | "slate" | "green" | "red";
}

export interface MeetingQueueItem {
  id: string;
  code: string;
  title: string;
  date: string;
  time: string;
  participants: number;
  tags: { label: string; tone: "blue" | "amber" | "red" | "slate" }[];
}

export interface MeetingCheck {
  id: string;
  label: string;
  tone: "success" | "warning";
}

export interface MeetingHistoryItem {
  id: string;
  time: string;
  text: string;
}

export interface MeetingCalendarRow {
  id: string;
  label: string;
  segments: { start: number; end: number; tone: "free" | "busy" | "unknown" }[];
}

export interface MeetingRequestDetails {
  id: string;
  code: string;
  title: string;
  statusLabel: string;
  initiator: string;
  manager: string;
  participants: number;
  agenda: string;
  date: string;
  time: string;
  duration: string;
  location: string;
  priority: string;
  priorityTone: "high" | "normal";
  checks: MeetingCheck[];
  recommendation: string;
}

export const meetingStats: MeetingStat[] = [
  { id: "new", label: "Новые", value: 4, tone: "blue" },
  { id: "checking", label: "Проверяются", value: 2, tone: "violet" },
  { id: "ud", label: "Требуют решения УД", value: 7, tone: "amber" },
  { id: "waiting", label: "Ожидают инициатора", value: 3, tone: "slate" },
  { id: "today", label: "Назначено сегодня", value: 12, tone: "green" },
  { id: "errors", label: "Ошибки интеграции", value: 1, tone: "red" }
];

export const meetingQueueTabs: { id: MeetingQueueTab; label: string }[] = [
  { id: "all", label: "Все заявки" },
  { id: "ud", label: "Требуют решения УД" },
  { id: "today", label: "СЗ за сегодня" },
  { id: "conflicts", label: "Конфликты" },
  { id: "errors", label: "Ошибки" }
];

export const meetingQueueItems: MeetingQueueItem[] = [
  {
    id: "000154",
    code: "СЗ №000154",
    title: "Запрос на совещание УД",
    date: "17.06.2026",
    time: "10:00",
    participants: 8,
    tags: [
      { label: "Не назначено", tone: "blue" },
      { label: "Более 5 участников", tone: "amber" },
      { label: "Нарушен срок подачи", tone: "red" }
    ]
  },
  {
    id: "000159",
    code: "СЗ №000159",
    title: "Срочное совещание по KPI",
    date: "17.06.2026",
    time: "14:30",
    participants: 4,
    tags: [{ label: "Не назначено", tone: "blue" }]
  },
  {
    id: "000141",
    code: "СЗ №000141",
    title: "Регламентное совещание отдела",
    date: "18.06.2026",
    time: "09:00",
    participants: 6,
    tags: [{ label: "Более 5 участников", tone: "amber" }]
  },
  {
    id: "000122",
    code: "СЗ №000122",
    title: "Outlook: ошибка интеграции",
    date: "16.06.2026",
    time: "—",
    participants: 3,
    tags: [{ label: "Ошибка интеграции", tone: "red" }]
  }
];

export const meetingRequestDetails: MeetingRequestDetails = {
  id: "000154",
  code: "СЗ №000154",
  title: "Запрос на совещание УД",
  statusLabel: "Не согласована",
  initiator: "Иванов И.И.",
  manager: "Петров П.П.",
  participants: 8,
  agenda: "Обсуждение KPI Q2",
  date: "17.06.2026",
  time: "10:00–10:30",
  duration: "30 мин",
  location: "Переговорная №2",
  priority: "Высокий",
  priorityTone: "high",
  checks: [
    { id: "1", label: "Тема корректна", tone: "success" },
    { id: "2", label: "Переговорная свободна", tone: "success" },
    { id: "3", label: "Количество участников: 8", tone: "warning" },
    { id: "4", label: "Срок подачи: 1 раб. день", tone: "warning" }
  ],
  recommendation:
    "Рекомендуется подтвердить как срочное совещание или выбрать альтернативный слот."
};

export const meetingCalendarRows: MeetingCalendarRow[] = [
  {
    id: "manager",
    label: "Руководитель",
    segments: [
      { start: 0, end: 35, tone: "free" },
      { start: 35, end: 55, tone: "busy" },
      { start: 55, end: 100, tone: "free" }
    ]
  },
  {
    id: "room",
    label: "Переговорная №2",
    segments: [
      { start: 0, end: 100, tone: "free" }
    ]
  },
  {
    id: "ivanov",
    label: "Иванов",
    segments: [
      { start: 0, end: 50, tone: "free" },
      { start: 50, end: 70, tone: "busy" },
      { start: 70, end: 100, tone: "free" }
    ]
  },
  {
    id: "petrov",
    label: "Петров",
    segments: [
      { start: 0, end: 30, tone: "free" },
      { start: 30, end: 60, tone: "busy" },
      { start: 60, end: 100, tone: "free" }
    ]
  },
  {
    id: "sidorov",
    label: "Сидоров",
    segments: [
      { start: 0, end: 100, tone: "unknown" }
    ]
  }
];

export const meetingAlternativeSlots = ["11:00–11:30", "15:00–15:30", "16:30–17:00"];

export const meetingHistory: MeetingHistoryItem[] = [
  { id: "1", time: "09:12", text: "Заявка получена из 1С ERP" },
  { id: "2", time: "09:13", text: "Проверены обязательные поля" },
  { id: "3", time: "09:14", text: "Найдено: более 5 участников" },
  { id: "4", time: "09:15", text: "Найдено: нарушен срок подачи" },
  { id: "5", time: "09:16", text: "Отправлено на решение УД" }
];
