import type { AgentAccess } from "@/types";
import { WAREHOUSE_AGENT_SLUG } from "@/utils/agentLaunch";

export const MOCK_WAREHOUSE_AGENT_ID = "mock-warehouse-agent";

export const mockWarehouseAgent: AgentAccess = {
  id: MOCK_WAREHOUSE_AGENT_ID,
  name: "Агент склада, запасов и выдачи в производство",
  slug: WAREHOUSE_AGENT_SLUG,
  purpose: "Контроль складских остатков, запасов и выдачи материалов в производство.",
  status: "active",
  icon_url: null,
  department_id: null,
  owner_id: null,
  created_at: "2026-07-10T00:00:00.000Z",
  updated_at: "2026-07-10T00:00:00.000Z",
  access_level: null,
  can_run: true,
  can_view_results: true,
  can_approve: false,
  can_configure: false
};

export type WarehouseNavId =
  | "overview"
  | "incoming"
  | "stock"
  | "picking"
  | "issue"
  | "deficit"
  | "deadstock"
  | "transfer"
  | "reports"
  | "settings";

export type WarehouseTone = "blue" | "green" | "violet" | "amber" | "red";

export type WarehouseOperationStatus =
  | "awaiting_acceptance"
  | "picking"
  | "partial_picking"
  | "below_min";

export type WarehousePriority = "high" | "medium" | "low";

export type WarehouseIconKey =
  | "overview"
  | "incoming"
  | "stock"
  | "picking"
  | "issue"
  | "deficit"
  | "deadstock"
  | "transfer"
  | "reports"
  | "settings"
  | "journal"
  | "truck"
  | "clipboard"
  | "package"
  | "alert"
  | "tag"
  | "receipt"
  | "warehouse"
  | "demand"
  | "issue-doc"
  | "stock-item"
  | "scale"
  | "clock"
  | "archive"
  | "qr"
  | "boxes"
  | "file"
  | "labels"
  | "map-pin"
  | "chart"
  | "truck-out";

export interface WarehouseNavItem {
  id: WarehouseNavId;
  label: string;
  icon: WarehouseIconKey;
}

export interface WarehouseStatCard {
  id: string;
  label: string;
  value: number;
  tone: WarehouseTone;
  icon: WarehouseIconKey;
}

export interface WarehouseOperationRow {
  id: string;
  objectTitle: string;
  objectIcon: WarehouseIconKey;
  source: string;
  status: WarehouseOperationStatus;
  deadline: string;
  responsible: string;
  nextAction: string;
}

export interface WarehouseDecisionItem {
  id: string;
  title: string;
  description: string;
  time: string;
  priority: WarehousePriority;
  icon: WarehouseIconKey;
  tone: WarehouseTone;
}

export interface WarehouseQuickAction {
  id: string;
  title: string;
  description: string;
  tone: WarehouseTone;
  icon: WarehouseIconKey;
}

export const warehouseNavItems: WarehouseNavItem[] = [
  { id: "overview", label: "Обзор", icon: "overview" },
  { id: "incoming", label: "Поступления", icon: "incoming" },
  { id: "stock", label: "Запасы", icon: "stock" },
  { id: "picking", label: "Комплектация", icon: "picking" },
  { id: "issue", label: "Выдача в производство", icon: "issue" },
  { id: "deficit", label: "Дефициты и МИН/МАКС", icon: "deficit" },
  { id: "deadstock", label: "Неликвиды", icon: "deadstock" },
  { id: "transfer", label: "Перемещения", icon: "transfer" },
  { id: "reports", label: "Отчеты и аналитика", icon: "reports" },
  { id: "settings", label: "Настройки", icon: "settings" }
];

export const warehouseStats: WarehouseStatCard[] = [
  { id: "incoming-today", label: "Поступлений сегодня", value: 18, tone: "blue", icon: "truck" },
  { id: "awaiting-acceptance", label: "Ожидают приемки", value: 7, tone: "green", icon: "clipboard" },
  { id: "picking", label: "На комплектации", value: 9, tone: "violet", icon: "package" },
  { id: "deficit", label: "Складской дефицит", value: 3, tone: "amber", icon: "alert" },
  { id: "deadstock", label: "Неликвиды", value: 12, tone: "red", icon: "tag" }
];

export const warehouseOperations: WarehouseOperationRow[] = [
  {
    id: "op-1",
    objectTitle: "Поступление №245-06",
    objectIcon: "receipt",
    source: 'Поставщик: ООО "Стальком"',
    status: "awaiting_acceptance",
    deadline: "Сегодня",
    responsible: "Селезнева Н.А.",
    nextAction: "Запустить приемку"
  },
  {
    id: "op-2",
    objectTitle: "Приходная №148",
    objectIcon: "warehouse",
    source: "Склад 0.1 «Логистика»",
    status: "picking",
    deadline: "16.06.2026",
    responsible: "Попов Д.С.",
    nextAction: "Проверить комплектацию"
  },
  {
    id: "op-3",
    objectTitle: "Потребность 3NK-145",
    objectIcon: "demand",
    source: "Цех сборки №4",
    status: "partial_picking",
    deadline: "Сегодня",
    responsible: "Морозов Р.В.",
    nextAction: "Дозаказать позиции"
  },
  {
    id: "op-4",
    objectTitle: "Выдача №87",
    objectIcon: "issue-doc",
    source: "Склад 9 «Метизы»",
    status: "awaiting_acceptance",
    deadline: "16.06.2026",
    responsible: "Кузнецова О.П.",
    nextAction: "Провести выдачу"
  },
  {
    id: "op-5",
    objectTitle: "Запас л.901-2",
    objectIcon: "stock-item",
    source: "Склад 29",
    status: "below_min",
    deadline: "Просрочено",
    responsible: "Агент / Иванов А.П.",
    nextAction: "Сформировать заказ"
  }
];

export const warehouseDecisions: WarehouseDecisionItem[] = [
  {
    id: "dec-1",
    title: "Расхождение по количеству",
    description: "Приемка №245-06: факт 48, по документу 50",
    time: "15 мин назад",
    priority: "high",
    icon: "scale",
    tone: "red"
  },
  {
    id: "dec-2",
    title: "Просроченная выдача в производство",
    description: "ЗНК №77 не выдана в срок на участок сборки",
    time: "32 мин назад",
    priority: "medium",
    icon: "clock",
    tone: "amber"
  },
  {
    id: "dec-3",
    title: "Неликвид без движения",
    description: "Позиция 190.77.5518: без движения 186 дней",
    time: "1 ч назад",
    priority: "medium",
    icon: "archive",
    tone: "violet"
  },
  {
    id: "dec-4",
    title: "Несоответствие маркировки",
    description: "По 3 позициям QR не совпадает с этикеткой",
    time: "1 ч назад",
    priority: "low",
    icon: "qr",
    tone: "blue"
  }
];

export const warehouseQuickActions: WarehouseQuickAction[] = [
  {
    id: "qa-1",
    title: "Принять ТМЦ",
    description: "Скан, сверка, акт приемки",
    tone: "blue",
    icon: "boxes"
  },
  {
    id: "qa-2",
    title: "Оприходовать в 1С",
    description: "Загрузить результат приемки",
    tone: "green",
    icon: "file"
  },
  {
    id: "qa-3",
    title: "Сформировать этикетки",
    description: "QR / штрихкод, печать",
    tone: "violet",
    icon: "labels"
  },
  {
    id: "qa-4",
    title: "Разместить на склад",
    description: "Адрес хранения, карта склада",
    tone: "amber",
    icon: "map-pin"
  },
  {
    id: "qa-5",
    title: "Комплектовать ЗНК",
    description: "Подбор, резерв, замены",
    tone: "blue",
    icon: "clipboard"
  },
  {
    id: "qa-6",
    title: "Выдать в производство",
    description: "Выдача, подтверждение цеха",
    tone: "green",
    icon: "truck-out"
  },
  {
    id: "qa-7",
    title: "Проверить МИН/МАКС",
    description: "Дефициты и пополнение",
    tone: "amber",
    icon: "chart"
  },
  {
    id: "qa-8",
    title: "Реестр неликвидов",
    description: "Анализ и списание",
    tone: "red",
    icon: "archive"
  }
];

export const warehouseAgentSubtitle =
  "Прием, оприходование, маркировка, комплектация, выдача в производство, контроль МИН/МАКС и неликвидов в едином рабочем контуре.";

export const warehouseAgentCardSubtitle =
  "Управление поступлениями, запасами, комплектацией и выдачей в производство.";

export const warehouseLastUpdated = "16.06.2026 10:24";

export const warehouseOperationStatusLabels: Record<WarehouseOperationStatus, string> = {
  awaiting_acceptance: "Ожидает приемки",
  picking: "На комплектации",
  partial_picking: "Частично скомплектовано",
  below_min: "Ниже МИН"
};

export const warehousePriorityLabels: Record<WarehousePriority, string> = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий"
};
