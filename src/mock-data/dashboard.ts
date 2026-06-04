export type DashboardStatTone = "blue" | "green" | "orange" | "violet";

export interface DashboardStatCard {
  id: string;
  title: string;
  value: number;
  tone: DashboardStatTone;
  icon: "bot" | "clipboard" | "warning" | "check";
  imageSrc?: string;
}

export interface QuickLaunchAgent {
  id: string;
  title: string;
  description: string;
  icon: "clipboard" | "documents" | "chart";
}

export type RecentTaskStatus = "needs_clarification" | "completed" | "approval" | "running";
export type DashboardActivityTone = "green" | "orange" | "blue" | "violet";

export interface RecentTask {
  id: string;
  title: string;
  agent: string;
  status: RecentTaskStatus;
  statusLabel: string;
  time: string;
  icon: "clipboard" | "document" | "cart";
}

export interface DashboardActivity {
  id: string;
  title: string;
  time: string;
  tone: DashboardActivityTone;
  icon: "check" | "user" | "document" | "book";
}

export const dashboardSummary = {
  activeTasks: 4,
  reviewRequired: 2,
  completed: 1
} as const;

export const dashboardStats: DashboardStatCard[] = [
  {
    id: "agents",
    title: "Доступные агенты",
    value: 8,
    tone: "blue",
    icon: "bot",
    imageSrc: "/login-feature-robot.png"
  },
  {
    id: "tasks",
    title: "Задачи в работе",
    value: 4,
    tone: "green",
    icon: "clipboard"
  },
  {
    id: "decisions",
    title: "Требуют решения",
    value: 2,
    tone: "orange",
    icon: "warning"
  },
  {
    id: "completed",
    title: "Завершено сегодня",
    value: 9,
    tone: "violet",
    icon: "check"
  }
];

export const quickLaunchAgents: QuickLaunchAgent[] = [
  {
    id: "op-check",
    title: "Агент проверки ОП",
    description: "Проверка полноты и корректности опросных листов",
    icon: "clipboard"
  },
  {
    id: "kd-td",
    title: "Агент КД/ТД",
    description: "Проверка комплектности и актуальности документации",
    icon: "documents"
  },
  {
    id: "tenders",
    title: "Агент тендеров",
    description: "Анализ закупок и подготовка заявки",
    icon: "chart"
  }
];

export const recentTasks: RecentTask[] = [
  {
    id: "op-245",
    title: "Проверка ОП №245",
    agent: "Агент проверки ОП",
    status: "needs_clarification",
    statusLabel: "Требует уточнения",
    time: "10:24",
    icon: "clipboard"
  },
  {
    id: "kd-118",
    title: "Проверка КД/ТД №118",
    agent: "Агент КД/ТД",
    status: "completed",
    statusLabel: "Завершено",
    time: "09:40",
    icon: "document"
  },
  {
    id: "tender-54",
    title: "Анализ тендера №54",
    agent: "Агент тендеров",
    status: "approval",
    statusLabel: "На согласовании",
    time: "Вчера",
    icon: "cart"
  },
  {
    id: "op-246",
    title: "Проверка ОП №246",
    agent: "Агент проверки ОП",
    status: "running",
    statusLabel: "Выполняется",
    time: "08:15",
    icon: "clipboard"
  }
];

export type RecommendedActionTone = "blue" | "green" | "violet";

export interface RecommendedAction {
  id: string;
  label: string;
  href: string;
  tone: RecommendedActionTone;
  icon: "clipboard" | "upload" | "book";
}

export const recommendedActions: RecommendedAction[] = [
  {
    id: "check-results",
    label: "Проверить результаты",
    href: "/tasks",
    tone: "blue",
    icon: "clipboard"
  },
  {
    id: "upload-document",
    label: "Загрузить документ",
    href: "/documents",
    tone: "green",
    icon: "upload"
  },
  {
    id: "open-knowledge",
    label: "Открыть базу знаний",
    href: "/knowledge-base",
    tone: "violet",
    icon: "book"
  }
];

export const dashboardActivities: DashboardActivity[] = [
  {
    id: "kd-finished",
    title: "Агент КД/ТД завершил проверку",
    time: "10:24",
    tone: "green",
    icon: "check"
  },
  {
    id: "result-approval",
    title: "Требуется согласование результата",
    time: "09:58",
    tone: "orange",
    icon: "user"
  },
  {
    id: "documents-uploaded",
    title: "Загружен новый комплект документов",
    time: "Вчера, 16:45",
    tone: "blue",
    icon: "document"
  },
  {
    id: "knowledge-updated",
    title: "Обновлена база знаний",
    time: "Вчера, 11:20",
    tone: "violet",
    icon: "book"
  }
];
