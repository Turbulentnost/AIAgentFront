import type { AgentAccess } from "@/types";
import { PRICING_AGENT_SLUG } from "@/utils/agentLaunch";

export const MOCK_PRICING_AGENT_ID = "mock-pricing-agent";

export const mockPricingAgent: AgentAccess = {
  id: MOCK_PRICING_AGENT_ID,
  name: "Агент цен, проектных цен, оплаты и договоров",
  slug: PRICING_AGENT_SLUG,
  purpose: "Контроль цен, проектных цен, оплаты и договорной документации.",
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

export type PricingTone = "blue" | "green" | "violet" | "amber" | "mint";

export type PricingIconKey =
  | "invoice"
  | "grid"
  | "chart"
  | "percent"
  | "user"
  | "wallet"
  | "file"
  | "trend"
  | "payment-request"
  | "overdue"
  | "invoice-stage"
  | "project-price"
  | "monitoring"
  | "contract"
  | "payment-app"
  | "payment"
  | "settlement";

export type InvoiceStatus = "requires_decision" | "in_progress" | "on_review" | "done";

export type RouteStageId =
  | "invoice"
  | "project_price"
  | "monitoring"
  | "contract"
  | "payment_request"
  | "payment"
  | "settlement";

export interface PricingStatCard {
  id: string;
  label: string;
  value: number;
  tone: PricingTone;
  icon: PricingIconKey;
}

export interface PricingInvoiceItem {
  id: string;
  title: string;
  amount: string;
  date: string;
  status: InvoiceStatus;
  nextStep: string;
}

export interface PricingQuickAction {
  id: string;
  label: string;
  icon: PricingIconKey;
}

export interface PricingRouteStage {
  id: RouteStageId;
  label: string;
  icon: PricingIconKey;
}

export const pricingAgentSubtitle =
  "Контроль экономической корректности закупки: проектные цены, договоры, счета, заявки на оплату и взаиморасчеты.";

export const pricingStats: PricingStatCard[] = [
  { id: "invoices-review", label: "Счетов на проверке", value: 24, tone: "blue", icon: "invoice" },
  { id: "above-project-price", label: "Выше проектной цены", value: 7, tone: "amber", icon: "chart" },
  { id: "needs-approval", label: "Требуют согласования", value: 12, tone: "violet", icon: "user" },
  { id: "awaiting-payment", label: "Ожидают оплаты", value: 18, tone: "green", icon: "wallet" }
];

export const pricingInvoices: PricingInvoiceItem[] = [
  {
    id: "inv-456",
    title: "Счет №456 / ООО ТехПоставка",
    amount: "1 250 000 ₽",
    date: "16.06.2025",
    status: "requires_decision",
    nextStep: "Мониторинг рынка"
  },
  {
    id: "inv-451",
    title: "Счет №451 / ООО РосПром",
    amount: "680 000 ₽",
    date: "16.06.2025",
    status: "in_progress",
    nextStep: "Согласование с заказчиком"
  },
  {
    id: "inv-449",
    title: "Счет №449 / ООО ТехПоставка",
    amount: "2 140 000 ₽",
    date: "15.06.2025",
    status: "on_review",
    nextStep: "Проектная цена"
  },
  {
    id: "inv-446",
    title: "Счет №446 / ООО МетСбыт",
    amount: "410 000 ₽",
    date: "15.06.2025",
    status: "done",
    nextStep: "Заявка на оплату"
  },
  {
    id: "inv-442",
    title: "Счет №442 / ИП Куликов",
    amount: "95 000 ₽",
    date: "14.06.2025",
    status: "on_review",
    nextStep: "Договор"
  }
];

export const pricingQuickActions: PricingQuickAction[] = [
  { id: "qa-open", label: "Открыть счет", icon: "file" },
  { id: "qa-check-price", label: "Проверить проектную цену", icon: "trend" },
  { id: "qa-payment-request", label: "Создать заявку на оплату", icon: "payment-request" },
  { id: "qa-overdue", label: "Показать просрочки", icon: "overdue" }
];

export const pricingRouteStages: PricingRouteStage[] = [
  { id: "invoice", label: "Счет", icon: "invoice-stage" },
  { id: "project_price", label: "Проектная цена", icon: "project-price" },
  { id: "monitoring", label: "Мониторинг", icon: "monitoring" },
  { id: "contract", label: "Договор", icon: "contract" },
  { id: "payment_request", label: "Заявка на оплату", icon: "payment-app" },
  { id: "payment", label: "Оплата", icon: "payment" },
  { id: "settlement", label: "Взаиморасчеты", icon: "settlement" }
];

export const pricingInvoiceStatusLabels: Record<InvoiceStatus, string> = {
  requires_decision: "Требует решения",
  in_progress: "В работе",
  on_review: "На проверке",
  done: "Готово"
};

export const pricingInvoiceQueueCount = 24;

export type PricingCheckStatus = "match" | "review";

export type PricingCheckIconKey =
  | "supplier"
  | "nomenclature"
  | "quantity"
  | "price"
  | "delivery"
  | "payment-terms"
  | "requisites"
  | "order-link";

export interface PricingInvoiceCheck {
  id: string;
  label: string;
  status: PricingCheckStatus;
  icon: PricingCheckIconKey;
}

export interface PricingInvoiceMetaItem {
  id: string;
  label: string;
  value: string;
  icon: PricingCheckIconKey;
  badge?: "verified";
}

export interface PricingInvoiceStageDetail {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplier: string;
  amount: string;
  basis: string;
  stageStatusLabel: string;
  currentStep: number;
  currentStageId: RouteStageId;
  stageTitle: string;
  stageResult: string;
  riskLevel: "low" | "medium" | "high";
  checks: PricingInvoiceCheck[];
  meta: PricingInvoiceMetaItem[];
}

export const PRICING_DEFAULT_INVOICE_ID = "inv-456";
export const PRICING_WORKFLOW_TOTAL_STEPS = 8;

export const pricingWorkflowSteps: Array<{ step: number; id: RouteStageId | "completed"; label: string }> = [
  { step: 1, id: "invoice", label: "Счет" },
  { step: 2, id: "project_price", label: "Проектная цена" },
  { step: 3, id: "monitoring", label: "Мониторинг" },
  { step: 4, id: "contract", label: "Договор" },
  { step: 5, id: "payment_request", label: "Заявка на оплату" },
  { step: 6, id: "payment", label: "Оплата" },
  { step: 7, id: "settlement", label: "Взаиморасчеты" },
  { step: 8, id: "completed", label: "Завершение" }
];

export const pricingRiskLabels: Record<PricingInvoiceStageDetail["riskLevel"], string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий"
};

const defaultInvoiceChecks: PricingInvoiceCheck[] = [
  { id: "supplier", label: "Поставщик", status: "match", icon: "supplier" },
  { id: "nomenclature", label: "Номенклатура", status: "match", icon: "nomenclature" },
  { id: "quantity", label: "Количество", status: "match", icon: "quantity" },
  { id: "price", label: "Цена", status: "review", icon: "price" },
  { id: "delivery", label: "Срок поставки", status: "match", icon: "delivery" },
  { id: "payment-terms", label: "Условия оплаты", status: "match", icon: "payment-terms" },
  { id: "requisites", label: "Реквизиты", status: "match", icon: "requisites" },
  { id: "order-link", label: "Связь с заказом поставщику", status: "match", icon: "order-link" }
];

const defaultInvoiceMeta: PricingInvoiceMetaItem[] = [
  { id: "supplier", label: "Поставщик", value: "ООО «ТехПоставка»", icon: "supplier" },
  { id: "order", label: "Заказ поставщику", value: "ЗК №245 от 10.06.2026", icon: "order-link" },
  { id: "payment", label: "Условия оплаты", value: "Отсрочка 30 дней", icon: "payment-terms" },
  { id: "delivery", label: "Срок поставки", value: "25.06.2026", icon: "delivery" },
  { id: "requisites", label: "Реквизиты поставщика", value: "Проверены", icon: "requisites", badge: "verified" }
];

export const pricingInvoiceStageDetails: Record<string, PricingInvoiceStageDetail> = {
  "inv-456": {
    invoiceId: "inv-456",
    invoiceNumber: "456",
    invoiceDate: "16.06.2026",
    supplier: "ООО «ТехПоставка»",
    amount: "625 000 ₽",
    basis: "ЗК №245",
    stageStatusLabel: "Проверка счета",
    currentStep: 1,
    currentStageId: "invoice",
    stageTitle: "Проверка счета",
    stageResult: "Счет соответствует заказу поставщику, но требуется проверка проектной цены",
    riskLevel: "medium",
    checks: defaultInvoiceChecks,
    meta: defaultInvoiceMeta
  }
};

/**
 * Возвращает детали этапа счета по id из очереди или собирает fallback из списка.
 */
export type PricingDeviationTone = "success" | "warning";

export type PricingComparisonStatus = "acceptable" | "above";

export interface PricingProjectPriceKpi {
  id: string;
  label: string;
  value: string;
  tone: PricingTone;
  icon: PricingIconKey;
}

export interface PricingComparisonRow {
  id: string;
  name: string;
  quantity: string;
  invoicePrice: string;
  projectPrice: string;
  deviation: string;
  deviationTone: PricingDeviationTone;
  status: PricingComparisonStatus;
}

export interface PricingAgentConclusionAction {
  id: string;
  label: string;
  icon: PricingIconKey;
}

export interface PricingProjectPriceStageDetail {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplier: string;
  amount: string;
  currentStep: number;
  currentStageId: RouteStageId;
  stageTitle: string;
  alertMessage: string;
  alertBadge: string;
  kpis: PricingProjectPriceKpi[];
  comparisonRows: PricingComparisonRow[];
  comparisonTotal: number;
  conclusionSummary: string;
  conclusionActions: PricingAgentConclusionAction[];
  conclusionNote: string;
}

export const pricingComparisonStatusLabels: Record<PricingComparisonStatus, string> = {
  acceptable: "Допустимо",
  above: "Выше ПЦ"
};


export function getPricingWorkflowStepByStageId(stageId: RouteStageId): number {
  return pricingWorkflowSteps.find((step) => step.id === stageId)?.step ?? 1;
}

export function getPricingInvoiceStageDetail(invoiceId: string): PricingInvoiceStageDetail | null {
  const preset = pricingInvoiceStageDetails[invoiceId];
  if (preset) return preset;

  const listItem = pricingInvoices.find((item) => item.id === invoiceId);
  if (!listItem) return null;

  const numberMatch = listItem.title.match(/№(\d+)/);
  const supplierMatch = listItem.title.match(/\/\s*(.+)$/);

  return {
    invoiceId: listItem.id,
    invoiceNumber: numberMatch?.[1] ?? listItem.id,
    invoiceDate: listItem.date,
    supplier: supplierMatch?.[1]?.trim() ?? "—",
    amount: listItem.amount,
    basis: "ЗК №245",
    stageStatusLabel: "Проверка счета",
    currentStep: 1,
    currentStageId: "invoice",
    stageTitle: "Проверка счета",
    stageResult: "Счет соответствует заказу поставщику, но требуется проверка проектной цены",
    riskLevel: "medium",
    checks: defaultInvoiceChecks,
    meta: [
      { id: "supplier", label: "Поставщик", value: supplierMatch?.[1]?.trim() ?? "—", icon: "supplier" },
      { id: "order", label: "Заказ поставщику", value: "ЗК №245 от 10.06.2026", icon: "order-link" },
      { id: "payment", label: "Условия оплаты", value: "Отсрочка 30 дней", icon: "payment-terms" },
      { id: "delivery", label: "Срок поставки", value: "25.06.2026", icon: "delivery" },
      { id: "requisites", label: "Реквизиты поставщика", value: "Проверены", icon: "requisites", badge: "verified" }
    ]
  };
}

const defaultProjectPriceComparison: PricingComparisonRow[] = [
  {
    id: "item-1",
    name: "Плата управления",
    quantity: "1 шт",
    invoicePrice: "128 000 ₽",
    projectPrice: "112 800 ₽",
    deviation: "+13,5%",
    deviationTone: "warning",
    status: "above"
  },
  {
    id: "item-2",
    name: "Датчик давления",
    quantity: "10 м",
    invoicePrice: "45 000 ₽",
    projectPrice: "39 600 ₽",
    deviation: "+13,6%",
    deviationTone: "warning",
    status: "above"
  },
  {
    id: "item-3",
    name: "Кабель силовой",
    quantity: "120 м",
    invoicePrice: "86 400 ₽",
    projectPrice: "82 800 ₽",
    deviation: "+4,3%",
    deviationTone: "success",
    status: "acceptable"
  },
  {
    id: "item-4",
    name: "Корпус металлический",
    quantity: "2 шт",
    invoicePrice: "54 000 ₽",
    projectPrice: "52 200 ₽",
    deviation: "+3,4%",
    deviationTone: "success",
    status: "acceptable"
  },
  {
    id: "item-5",
    name: "Блок питания",
    quantity: "4 шт",
    invoicePrice: "72 000 ₽",
    projectPrice: "70 400 ₽",
    deviation: "+2,3%",
    deviationTone: "success",
    status: "acceptable"
  },
  {
    id: "item-6",
    name: "Комплект крепежа",
    quantity: "1 компл",
    invoicePrice: "18 500 ₽",
    projectPrice: "18 500 ₽",
    deviation: "0%",
    deviationTone: "success",
    status: "acceptable"
  }
];

export const pricingProjectPriceStageDetails: Record<string, PricingProjectPriceStageDetail> = {
  "inv-456": {
    invoiceId: "inv-456",
    invoiceNumber: "456",
    invoiceDate: "16.06.2025",
    supplier: "ООО «ТехПоставка»",
    amount: "1 256 200 ₽",
    currentStep: 2,
    currentStageId: "project_price",
    stageTitle: "Проверка проектной цены",
    alertMessage: "Цена выше проектной по 2 позициям, требуется решение",
    alertBadge: "Требует решения",
    kpis: [
      { id: "positions", label: "Позиций в счете", value: "6", tone: "blue", icon: "grid" },
      { id: "above-price", label: "Выше проектной цены", value: "2", tone: "amber", icon: "trend" },
      { id: "max-deviation", label: "Отклонение max", value: "+13,6%", tone: "violet", icon: "percent" },
      { id: "needs-decision", label: "Требуют решения", value: "1", tone: "amber", icon: "overdue" }
    ],
    comparisonRows: defaultProjectPriceComparison,
    comparisonTotal: 6,
    conclusionSummary: "По счету выявлены 2 позиции, цена которых превышает проектную цену.",
    conclusionActions: [
      { id: "monitoring", label: "Запустить мониторинг рынка по позициям с отклонением", icon: "monitoring" },
      { id: "memo", label: "Подготовить СЗ на изменение проектной цены", icon: "file" }
    ],
    conclusionNote:
      "Максимальное отклонение — по позиции «Датчик давления» (+13,6%). Превышение допустимого порога 5%."
  }
};

/**
 * Возвращает детали этапа проектной цены по id счета.
 */
export function getPricingProjectPriceStageDetail(invoiceId: string): PricingProjectPriceStageDetail | null {
  const preset = pricingProjectPriceStageDetails[invoiceId];
  if (preset) return preset;

  const invoiceDetail = getPricingInvoiceStageDetail(invoiceId);
  if (!invoiceDetail) return null;

  return {
    invoiceId: invoiceDetail.invoiceId,
    invoiceNumber: invoiceDetail.invoiceNumber,
    invoiceDate: invoiceDetail.invoiceDate,
    supplier: invoiceDetail.supplier,
    amount: invoiceDetail.amount,
    currentStep: 2,
    currentStageId: "project_price",
    stageTitle: "Проверка проектной цены",
    alertMessage: "Цена выше проектной по 2 позициям, требуется решение",
    alertBadge: "Требует решения",
    kpis: pricingProjectPriceStageDetails[PRICING_DEFAULT_INVOICE_ID].kpis,
    comparisonRows: defaultProjectPriceComparison,
    comparisonTotal: 6,
    conclusionSummary: "По счету выявлены 2 позиции, цена которых превышает проектную цену.",
    conclusionActions: pricingProjectPriceStageDetails[PRICING_DEFAULT_INVOICE_ID].conclusionActions,
    conclusionNote:
      "Максимальное отклонение — по позиции «Датчик давления» (+13,6%). Превышение допустимого порога 5%."
  };
}

export type MonitoringRatingStatus = "recommended" | "expensive" | "document_risk";

export type MonitoringDocumentStatus = "complete" | "risk";

export type MonitoringPriceDeltaTone = "success" | "danger";

export type MonitoringSidebarIconKey = "target" | "cart" | "progress" | "clock" | "shield" | "risk";

export interface MonitoringOfferRow {
  id: string;
  supplier: string;
  price: string;
  priceDelta?: string;
  priceDeltaTone?: MonitoringPriceDeltaTone;
  term: string;
  paymentTerms: string;
  documentLabel: string;
  documentStatus: MonitoringDocumentStatus;
  rating: MonitoringRatingStatus;
}

export interface MonitoringStageProgressItem {
  id: string;
  label: string;
  value: string;
  icon: MonitoringSidebarIconKey;
}

export interface MonitoringEvaluationCriterion {
  id: string;
  label: string;
  icon: Extract<MonitoringSidebarIconKey, "shield" | "clock" | "risk">;
}

export interface MonitoringStatusChip {
  id: string;
  label: string;
  value: string;
  tone: PricingTone;
  icon: Extract<MonitoringSidebarIconKey, "shield" | "clock" | "risk">;
}

export interface PricingMonitoringStageDetail {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplier: string;
  amount: string;
  currentStep: number;
  currentStageId: RouteStageId;
  stageTitle: string;
  workflowStatusLabel: string;
  nextStepLabel: string;
  infoMessage: string;
  offers: MonitoringOfferRow[];
  conclusionSummary: string;
  statusChips: MonitoringStatusChip[];
  progressItems: MonitoringStageProgressItem[];
  evaluationCriteria: MonitoringEvaluationCriterion[];
}

export const monitoringRatingLabels: Record<MonitoringRatingStatus, string> = {
  recommended: "Рекомендуется",
  expensive: "Дороже",
  document_risk: "Риск по документам"
};

const defaultMonitoringOffers: MonitoringOfferRow[] = [
  {
    id: "offer-1",
    supplier: "ООО «ТехПоставка»",
    price: "1 250 000 ₽",
    term: "20 дней",
    paymentTerms: "30% предоплата",
    documentLabel: "Полный комплект",
    documentStatus: "complete",
    rating: "recommended"
  },
  {
    id: "offer-2",
    supplier: "ООО «Комплект-Снаб»",
    price: "1 380 000 ₽",
    priceDelta: "+10,4%",
    priceDeltaTone: "danger",
    term: "25 дней",
    paymentTerms: "50% предоплата",
    documentLabel: "Полный комплект",
    documentStatus: "complete",
    rating: "expensive"
  },
  {
    id: "offer-3",
    supplier: "ООО «ЭлектроРесурс»",
    price: "1 210 000 ₽",
    priceDelta: "−3,2%",
    priceDeltaTone: "success",
    term: "18 дней",
    paymentTerms: "100% предоплата",
    documentLabel: "Риски по документам",
    documentStatus: "risk",
    rating: "document_risk"
  }
];

const defaultMonitoringProgress: MonitoringStageProgressItem[] = [
  {
    id: "goal",
    label: "Цель",
    value: "Собрать и сравнить не менее 3 коммерческих предложений на аналогичную номенклатуру",
    icon: "target"
  },
  {
    id: "requirement",
    label: "Требование",
    value: "Минимум 2 подтверждения рыночной цены",
    icon: "cart"
  },
  {
    id: "progress",
    label: "Прогресс",
    value: "Получено 3 из 3 (100%)",
    icon: "progress"
  },
  {
    id: "remaining",
    label: "Осталось",
    value: "Проанализировать предложения и сформировать вывод",
    icon: "clock"
  }
];

const defaultEvaluationCriteria: MonitoringEvaluationCriterion[] = [
  { id: "quality", label: "Документы качества", icon: "shield" },
  { id: "term", label: "Срок", icon: "clock" },
  { id: "risk", label: "Риск", icon: "risk" }
];

const defaultMonitoringStatusChips: MonitoringStatusChip[] = [
  { id: "quality", label: "Документы качества", value: "Низкий риск", tone: "green", icon: "shield" },
  { id: "term", label: "Срок", value: "Реалистичный", tone: "blue", icon: "clock" },
  { id: "risk", label: "Риск", value: "Низкий риск", tone: "amber", icon: "risk" }
];

export const pricingMonitoringStageDetails: Record<string, PricingMonitoringStageDetail> = {
  "inv-456": {
    invoiceId: "inv-456",
    invoiceNumber: "456",
    invoiceDate: "16.06.2025",
    supplier: "ООО «ТехПоставка»",
    amount: "1 250 000 ₽",
    currentStep: 3,
    currentStageId: "monitoring",
    stageTitle: "Мониторинг рынка",
    workflowStatusLabel: "В работе",
    nextStepLabel: "Формирование вывода и рекомендаций",
    infoMessage:
      "Для перехода к следующему этапу требуется не менее 2–3 подтверждений рыночной цены по позициям с отклонением от проектной цены.",
    offers: defaultMonitoringOffers,
    conclusionSummary:
      "Оптимальным по балансу цены и рисков является предложение ООО «ТехПоставка». У ООО «ЭлектроРесурс» ниже цена, но выявлены риски по комплекту документов.",
    statusChips: defaultMonitoringStatusChips,
    progressItems: defaultMonitoringProgress,
    evaluationCriteria: defaultEvaluationCriteria
  }
};

/**
 * Возвращает детали этапа мониторинга рынка по id счета.
 */
export function getPricingMonitoringStageDetail(invoiceId: string): PricingMonitoringStageDetail | null {
  const preset = pricingMonitoringStageDetails[invoiceId];
  if (preset) return preset;

  const projectDetail = getPricingProjectPriceStageDetail(invoiceId);
  if (!projectDetail) return null;

  return {
    invoiceId: projectDetail.invoiceId,
    invoiceNumber: projectDetail.invoiceNumber,
    invoiceDate: projectDetail.invoiceDate,
    supplier: projectDetail.supplier,
    amount: "1 250 000 ₽",
    currentStep: 3,
    currentStageId: "monitoring",
    stageTitle: "Мониторинг рынка",
    workflowStatusLabel: "В работе",
    nextStepLabel: "Формирование вывода и рекомендаций",
    infoMessage: pricingMonitoringStageDetails[PRICING_DEFAULT_INVOICE_ID].infoMessage,
    offers: defaultMonitoringOffers,
    conclusionSummary: pricingMonitoringStageDetails[PRICING_DEFAULT_INVOICE_ID].conclusionSummary,
    statusChips: defaultMonitoringStatusChips,
    progressItems: defaultMonitoringProgress,
    evaluationCriteria: defaultEvaluationCriteria
  };
}

/* ─── Stage 4: Актуализация проектной цены (contract route) ─── */

export type ApprovalRouteStatus = "approved" | "in_progress" | "pending";

export interface PricingPriceTile {
  id: string;
  label: string;
  value: string;
  tone: PricingTone;
}

export interface PricingApprovalRouteStep {
  id: string;
  role: string;
  status: ApprovalRouteStatus;
  statusLabel: string;
  detail?: string;
  timestamp?: string;
}

export interface PricingMemoAttachment {
  id: string;
  name: string;
  type: "pdf" | "xlsx" | "eml";
}

export interface PricingContractStageDetail {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  contractNumber: string;
  contractDate: string;
  supplier: string;
  amount: string;
  currentStep: number;
  currentStageId: RouteStageId;
  stageTitle: string;
  responsibleAgent: string;
  changeReason: string;
  priceTiles: PricingPriceTile[];
  approvalRoute: PricingApprovalRouteStep[];
  memoOldPrice: string;
  memoNewPrice: string;
  memoChangePercent: string;
  memoChangeReason: string;
  memoAttachments: PricingMemoAttachment[];
  memoComment: string;
}

export const approvalRouteStatusLabels: Record<ApprovalRouteStatus, string> = {
  approved: "Согласовано",
  in_progress: "Согласование",
  pending: "Ожидает"
};

export const pricingContractStageDetails: Record<string, PricingContractStageDetail> = {
  "inv-456": {
    invoiceId: "inv-456",
    invoiceNumber: "2456",
    invoiceDate: "15.01.2026",
    contractNumber: "Д-2456/25",
    contractDate: "10.01.2026",
    supplier: "ООО ТехПоставка",
    amount: "625 000 ₽",
    currentStep: 4,
    currentStageId: "contract",
    stageTitle: "Актуализация проектной цены",
    responsibleAgent: "Агент проектных цен",
    changeReason:
      "Текущая проектная цена устарела. Зафиксировано отклонение +12% и подтверждение альтернативными КП.",
    priceTiles: [
      { id: "old", label: "Старая ПЦ", value: "557 000 ₽", tone: "blue" },
      { id: "new", label: "Новая ПЦ", value: "625 000 ₽", tone: "green" },
      { id: "date", label: "Дата установки", value: "15.01.2026", tone: "violet" }
    ],
    approvalRoute: [
      {
        id: "manager",
        role: "Менеджер ОМТО",
        status: "approved",
        statusLabel: "Согласовано",
        timestamp: "14.01.2026, 16:42"
      },
      {
        id: "head",
        role: "Начальник ОМТО",
        status: "in_progress",
        statusLabel: "Согласование",
        detail: "Ожидает действий"
      },
      {
        id: "finance",
        role: "Финансовая служба",
        status: "pending",
        statusLabel: "Ожидает"
      },
      {
        id: "director",
        role: "Исполнительный директор",
        status: "pending",
        statusLabel: "Ожидает"
      }
    ],
    memoOldPrice: "557 000 ₽",
    memoNewPrice: "625 000 ₽",
    memoChangePercent: "+12%",
    memoChangeReason:
      "Текущая проектная цена устарела. Зафиксировано отклонение +12% и подтверждение альтернативными КП.",
    memoAttachments: [
      { id: "a1", name: "КП №125... .pdf", type: "pdf" },
      { id: "a2", name: "Счет №2456... .pdf", type: "pdf" },
      { id: "a3", name: "Мониторинг рынка.xlsx", type: "xlsx" },
      { id: "a4", name: "Письмо поставщика.eml", type: "eml" }
    ],
    memoComment: "Подготовлено на основании анализа рынка и подтверждающих коммерческих предложений."
  }
};

export function getPricingContractStageDetail(invoiceId: string): PricingContractStageDetail | null {
  const preset = pricingContractStageDetails[invoiceId];
  if (preset) return preset;

  const monitoring = getPricingMonitoringStageDetail(invoiceId);
  if (!monitoring) return null;

  return pricingContractStageDetails[PRICING_DEFAULT_INVOICE_ID];
}

/* ─── Stage 5: Проверка договора (payment_request route) ─── */

export type ContractCheckResult = "yes" | "no";

export interface PricingContractCheckRow {
  id: string;
  label: string;
  result: ContractCheckResult;
}

export interface PricingContractFallbackAction {
  id: string;
  label: string;
}

export interface PricingPaymentRequestStageDetail {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplier: string;
  amount: string;
  currentStep: number;
  currentStageId: RouteStageId;
  stageTitle: string;
  stageResultTitle: string;
  stageResultText: string;
  stageResultNote: string;
  contractNumber: string;
  contractStatus: string;
  contractValidUntil: string;
  contractVersion: string;
  contractAttached: string;
  fallbackActions: PricingContractFallbackAction[];
  contractChecks: PricingContractCheckRow[];
}

export const pricingPaymentRequestStageDetails: Record<string, PricingPaymentRequestStageDetail> = {
  "inv-456": {
    invoiceId: "inv-456",
    invoiceNumber: "456",
    invoiceDate: "16.06.2026",
    supplier: "ООО «ТехПоставка»",
    amount: "1 250 000 ₽",
    currentStep: 5,
    currentStageId: "payment_request",
    stageTitle: "Проверка договора",
    stageResultTitle: "Действующий договор найден, закупка возможна",
    stageResultText: "Успешно",
    stageResultNote: "Проверка договора завершена успешно.",
    contractNumber: "Д-45/2026",
    contractStatus: "Действует",
    contractValidUntil: "до 31.12.2026",
    contractVersion: "1.0",
    contractAttached: "Да",
    fallbackActions: [
      { id: "route", label: "Запустить договорной маршрут" },
      { id: "lawyer", label: "Передать юристу" },
      { id: "search", label: "Искать другие договоры" }
    ],
    contractChecks: [
      { id: "active", label: "Действующий договор", result: "yes" },
      { id: "attached", label: "Вложен в карточку контрагента", result: "yes" },
      { id: "payment", label: "Условия оплаты соответствуют счету", result: "yes" },
      { id: "new", label: "Требуется новый договор", result: "no" },
      { id: "security", label: "Требуется проверка СБ", result: "no" },
      { id: "legal", label: "Требуется юридическая проверка", result: "no" }
    ]
  }
};

export function getPricingPaymentRequestStageDetail(invoiceId: string): PricingPaymentRequestStageDetail | null {
  const preset = pricingPaymentRequestStageDetails[invoiceId];
  if (preset) return preset;

  const contract = getPricingContractStageDetail(invoiceId);
  if (!contract) return null;

  return pricingPaymentRequestStageDetails[PRICING_DEFAULT_INVOICE_ID];
}

/* ─── Stage 6: Формирование заявки на оплату (payment route) ─── */

export interface PricingPaymentFormulaItem {
  id: string;
  label: string;
}

export interface PricingPaymentBasisField {
  id: string;
  label: string;
  value: string;
}

export interface PricingPaymentFormField {
  id: string;
  label: string;
  value: string;
}

export interface PricingPaymentStageDetail {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplier: string;
  supplierInn: string;
  amount: string;
  currentStep: number;
  currentStageId: RouteStageId;
  stageTitle: string;
  recommendedPaymentDate: string;
  formulaItems: PricingPaymentFormulaItem[];
  formulaResult: string;
  basisFields: PricingPaymentBasisField[];
  formFields: PricingPaymentFormField[];
  limitsStatus: string;
  limitsAvailable: string;
  urgencyTone: "amber";
}

export const pricingPaymentStageDetails: Record<string, PricingPaymentStageDetail> = {
  "inv-456": {
    invoiceId: "inv-456",
    invoiceNumber: "456",
    invoiceDate: "16.06.2026",
    supplier: "ООО ТехПоставка",
    supplierInn: "7723456789",
    amount: "1 250 000 ₽",
    currentStep: 6,
    currentStageId: "payment",
    stageTitle: "Формирование заявки на оплату",
    recommendedPaymentDate: "не позднее 12.08.2026",
    formulaItems: [
      { id: "need", label: "дата потребности 20.08.2026" },
      { id: "delivery", label: "срок поставки 5 раб. дней" },
      { id: "control", label: "входной контроль 1 день" },
      { id: "accept", label: "оприходование 1 день" }
    ],
    formulaResult: "рекомендуемая дата 12.08.2026",
    basisFields: [
      { id: "supplier", label: "Поставщик", value: "ООО ТехПоставка" },
      { id: "amount", label: "Сумма", value: "1 250 000 ₽" },
      { id: "basis", label: "Заказ / Основание", value: "Заказ №245 от 10.06.2026" },
      { id: "urgency", label: "Срочность", value: "Высокая" },
      { id: "cfo", label: "ЦФО", value: "IT департамент" },
      { id: "expense", label: "Статья расходов", value: "Материалы и комплектующие" }
    ],
    formFields: [
      { id: "supplier", label: "Поставщик", value: "ООО ТехПоставка" },
      { id: "amount", label: "Сумма", value: "1 250 000 ₽" },
      { id: "basis", label: "Основание", value: "Заказ №245 от 10.06.2026" },
      { id: "date", label: "Дата оплаты", value: "12.08.2026" },
      { id: "urgency", label: "Срочность", value: "Высокая" },
      { id: "cfo", label: "ЦФО", value: "IT департамент" },
      { id: "expense", label: "Статья расходов", value: "Материалы и комплектующие" }
    ],
    limitsStatus: "Лимиты ДС: в норме",
    limitsAvailable: "Доступно: 2 450 000 ₽ из 3 000 000 ₽",
    urgencyTone: "amber"
  }
};

export function getPricingPaymentStageDetail(invoiceId: string): PricingPaymentStageDetail | null {
  const preset = pricingPaymentStageDetails[invoiceId];
  if (preset) return preset;

  const paymentRequest = getPricingPaymentRequestStageDetail(invoiceId);
  if (!paymentRequest) return null;

  return pricingPaymentStageDetails[PRICING_DEFAULT_INVOICE_ID];
}

/* ─── Stage 7: Контроль оплаты (settlement route) ─── */

export type ApprovalTimelineStatus = "completed" | "current" | "pending";

export interface PricingPaymentControlKpi {
  id: string;
  label: string;
  value: string;
  sublabel: string;
  tone: PricingTone;
}

export interface PricingApprovalTimelineItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  user: string;
  status: ApprovalTimelineStatus;
}

export interface PricingSettlementStageDetail {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplier: string;
  amount: string;
  currentStep: number;
  currentStageId: RouteStageId;
  stageTitle: string;
  progressPercent: number;
  kpis: PricingPaymentControlKpi[];
  timeline: PricingApprovalTimelineItem[];
  delayImpact: string;
  lastUpdated: string;
}

export const pricingSettlementStageDetails: Record<string, PricingSettlementStageDetail> = {
  "inv-456": {
    invoiceId: "inv-456",
    invoiceNumber: "456",
    invoiceDate: "16.06.2026",
    supplier: "ООО «ТехПоставка»",
    amount: "1 250 000 ₽",
    currentStep: 7,
    currentStageId: "settlement",
    stageTitle: "Контроль оплаты",
    progressPercent: 76,
    kpis: [
      {
        id: "approval",
        label: "На согласовании",
        value: "Да",
        sublabel: "Статус оплаты",
        tone: "violet"
      },
      {
        id: "approver",
        label: "Текущий согласующий",
        value: "Финансовый директор",
        sublabel: "Согласующий",
        tone: "blue"
      },
      {
        id: "date",
        label: "Плановая дата оплаты",
        value: "12.08.2026",
        sublabel: "Через 4 дня",
        tone: "green"
      },
      {
        id: "risk",
        label: "Риск задержки",
        value: "Средний",
        sublabel: "Вероятность влияния на поставку",
        tone: "amber"
      }
    ],
    timeline: [
      {
        id: "created",
        title: "Заявка сформирована",
        description: "Заявка на оплату создана и передана на согласование",
        timestamp: "06.08.2026, 10:15",
        user: "Агент оплаты",
        status: "completed"
      },
      {
        id: "omto",
        title: "Согласована начальником ОМТО",
        description: "Начальник ОМТО согласовал заявку на оплату",
        timestamp: "06.08.2026, 14:32",
        user: "Начальник ОМТО",
        status: "completed"
      },
      {
        id: "finance",
        title: "Передана финансовому директору",
        description: "Заявка передана на согласование финансовому директору",
        timestamp: "07.08.2026, 09:05",
        user: "Агент оплаты",
        status: "completed"
      },
      {
        id: "pending",
        title: "Ожидается согласование",
        description: "Финансовый директор рассматривает заявку на оплату",
        timestamp: "—",
        user: "Финансовый директор",
        status: "current"
      }
    ],
    delayImpact:
      "Каждый день задержки сдвигает дату поставки с 17.08.2026 на 18.08.2026. Сформирован средний риск срыва сроков.",
    lastUpdated: "сегодня, 08:32"
  }
};

export function getPricingSettlementStageDetail(invoiceId: string): PricingSettlementStageDetail | null {
  const preset = pricingSettlementStageDetails[invoiceId];
  if (preset) return preset;

  const payment = getPricingPaymentStageDetail(invoiceId);
  if (!payment) return null;

  return pricingSettlementStageDetails[PRICING_DEFAULT_INVOICE_ID];
}

/* ─── Stage 8: Контроль взаиморасчетов (completed route) ─── */

export type SettlementCheckStatus = "waiting" | "no" | "yes";

export interface PricingSettlementCheckRow {
  id: string;
  label: string;
  status: SettlementCheckStatus;
  statusLabel: string;
  comment: string;
}

export interface PricingCompletionStageDetail {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  supplier: string;
  amount: string;
  processId: string;
  currentStep: number;
  stageTitle: string;
  settlementStatus: string;
  settlementDescription: string;
  unclosedAdvances: string;
  closingDocuments: string;
  actionsRequired: string;
  checks: PricingSettlementCheckRow[];
  recommendation: string;
}

export const pricingCompletionStageDetails: Record<string, PricingCompletionStageDetail> = {
  "inv-456": {
    invoiceId: "inv-456",
    invoiceNumber: "456",
    invoiceDate: "15.06.2025",
    supplier: "ООО ТехПоставка",
    amount: "1 250 000 ₽",
    processId: "PROC-2025-0615-0456",
    currentStep: 8,
    stageTitle: "Контроль взаиморасчетов и закрытие",
    settlementStatus: "Частично закрыто",
    settlementDescription: "аванс 312 500 ₽, поставка ожидается, закрывающие документы не получены",
    unclosedAdvances: "312 500 ₽",
    closingDocuments: "0 / 2",
    actionsRequired: "1",
    checks: [
      {
        id: "advance",
        label: "Аванс закрыт",
        status: "waiting",
        statusLabel: "Ожидается",
        comment: "Получен аванс 312 500 ₽ из 1 250 000 ₽"
      },
      {
        id: "delivery",
        label: "Поставка поступила",
        status: "no",
        statusLabel: "Нет",
        comment: "Поставка по счету №456 еще не поступила"
      },
      {
        id: "upd",
        label: "УПД получен",
        status: "no",
        statusLabel: "Нет",
        comment: "УПД отсутствует"
      },
      {
        id: "vat",
        label: "Счет-фактура получена",
        status: "no",
        statusLabel: "Нет",
        comment: "Счет-фактура не получена"
      },
      {
        id: "overpay",
        label: "Переплата есть",
        status: "no",
        statusLabel: "Нет",
        comment: "Переплата отсутствует"
      },
      {
        id: "refund",
        label: "Требуется возврат средств",
        status: "yes",
        statusLabel: "Да",
        comment: "Имеется аванс без поставки"
      },
      {
        id: "claim",
        label: "Требуется претензия",
        status: "yes",
        statusLabel: "Да",
        comment: "Срок поставки нарушен, требуется действие"
      }
    ],
    recommendation:
      "Если поставщик нарушил сроки поставки, запросите возврат денежных средств или подготовите претензию."
  }
};

export function getPricingCompletionStageDetail(invoiceId: string): PricingCompletionStageDetail | null {
  const preset = pricingCompletionStageDetails[invoiceId];
  if (preset) return preset;

  const settlement = getPricingSettlementStageDetail(invoiceId);
  if (!settlement) return null;

  return pricingCompletionStageDetails[PRICING_DEFAULT_INVOICE_ID];
}

