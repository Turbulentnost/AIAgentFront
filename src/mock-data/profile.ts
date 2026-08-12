export type ProfileAgentTone = "blue" | "green" | "violet" | "orange" | "slate";
export type ProfileAgentIcon = "document" | "clipboard" | "analysis" | "cart" | "trophy";

export interface ProfileAgentCard {
  id: string;
  title: string;
  description: string;
  tone: ProfileAgentTone;
  icon: ProfileAgentIcon;
  accessLabel: string;
  href: string;
  isLocked?: boolean;
}

export interface ProfileSecurityItem {
  id: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  icon: "lock" | "shield" | "monitor";
}

export interface ProfileActivityItem {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  icon: "play" | "upload" | "report";
  tone: "blue" | "green" | "violet";
}

export const profileFallbacks = {
  divisionName: "Служба развития",
  subdivisionName: "Сектор ИИ",
  departmentName: "Сектор ИИ",
  roleName: "Сотрудник",
  position: "Инженер-конструктор",
  phone: "+7 (928) 123-45-67",
  createdAt: "2024-03-12T09:00:00.000Z",
  lastLoginAt: "2026-06-04T09:14:00.000Z"
} as const;

export function resolveDepartmentLabels(
  departments: Array<{ id: string; name: string; parent_id: string | null }> | undefined,
  departmentId: string | null | undefined
) {
  const department = departments?.find((item) => item.id === departmentId);
  const subdivisionName = department?.name ?? profileFallbacks.subdivisionName;
  const divisionName =
    (department?.parent_id
      ? departments?.find((item) => item.id === department.parent_id)?.name
      : null) ?? profileFallbacks.divisionName;
  return { divisionName, subdivisionName };
}

export const roleNameById: Record<string, string> = {
  employee: "Сотрудник",
  engineer: "Инженер",
  admin: "Администратор",
  superadmin: "Суперадминистратор"
};

export const mockProfileAgents: ProfileAgentCard[] = [
  {
    id: "kd-td",
    title: "Агент КД/ТД",
    description: "Проверка конструкторской и технической документации",
    tone: "blue",
    icon: "document",
    accessLabel: "Запуск и просмотр",
    href: "/agents"
  },
  {
    id: "nd",
    title: "Агент НД",
    description: "Проверка нормативной документации",
    tone: "green",
    icon: "clipboard",
    accessLabel: "Просмотр",
    href: "/agents"
  },
  {
    id: "ol",
    title: "Агент ОЛ",
    description: "Проверка и анализ опросных листов",
    tone: "violet",
    icon: "analysis",
    accessLabel: "Запуск",
    href: "/agents"
  },
  {
    id: "purchase",
    title: "Агент закупок",
    description: "Формирование закупочной потребности",
    tone: "orange",
    icon: "cart",
    accessLabel: "Только просмотр",
    href: "/agents"
  },
  {
    id: "tender",
    title: "Агент тендеров",
    description: "Анализ тендерной документации",
    tone: "slate",
    icon: "trophy",
    accessLabel: "Нет доступа",
    href: "/agents",
    isLocked: true
  }
];

export const mockSecurityItems: ProfileSecurityItem[] = [
  {
    id: "password",
    title: "Пароль",
    subtitle: "Последнее изменение: 12.05.2026",
    actionLabel: "Сменить пароль",
    icon: "lock"
  },
  {
    id: "mfa",
    title: "Двухфакторная аутентификация",
    subtitle: "Не подключена",
    actionLabel: "Подключить",
    icon: "shield"
  },
  {
    id: "sessions",
    title: "Активные сессии",
    subtitle: "2 активные сессии",
    actionLabel: "Управление",
    icon: "monitor"
  }
];

export const mockProfileActivities: ProfileActivityItem[] = [
  {
    id: "agent-run",
    title: "Запуск агента КД/ТД",
    subtitle: "Проверка чертежа № KD-2026-015",
    time: "Сегодня, 10:22",
    icon: "play",
    tone: "blue"
  },
  {
    id: "document-upload",
    title: "Загрузка документа",
    subtitle: "Файл: specification.xlsx",
    time: "Сегодня, 10:18",
    icon: "upload",
    tone: "green"
  },
  {
    id: "report-view",
    title: "Просмотр отчета",
    subtitle: "Отчет по задаче KD-2026-004",
    time: "Вчера, 16:40",
    icon: "report",
    tone: "violet"
  }
];
