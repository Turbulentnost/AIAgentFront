/** TEMP(Aveon) — удалить вместе с TEMP-блоком 1С */

export function formatAveonDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type StockStatus = {
  last_sync_at: string | null;
  status: string | null;
  saved_count: number;
  db_count: number;
  positive_count?: number;
  negative_count?: number;
  error_message?: string | null;
};

type ResourceSpecsStatus = {
  last_sync_at: string | null;
  status: string | null;
  specs_count: number;
  materials_count: number;
  outputs_count: number;
  db_specs: number;
  db_materials: number;
  db_outputs: number;
  error_message?: string | null;
};

type ProductionPlanStatus = {
  last_sync_at: string | null;
  status: string | null;
  saved_count: number;
  db_count: number;
  plan_number: string;
  plan_date: string | null;
  error_message?: string | null;
};

export function buildStockFreshnessLabel(stock: StockStatus | null | undefined): string {
  if (!stock?.last_sync_at) {
    return stock?.db_count ? `В БД ${stock.db_count.toLocaleString("ru-RU")} поз., дата синхронизации неизвестна` : "Ещё не синхронизировалось";
  }
  const when = formatAveonDateTime(stock.last_sync_at);
  const count = (stock.db_count || stock.saved_count || 0).toLocaleString("ru-RU");
  if (stock.status && stock.status !== "ok") {
    return `Последняя попытка: ${when} · ошибка`;
  }
  return `Последняя выгрузка из 1С: ${when} · ${count} поз.`;
}

export function buildSpecsFreshnessLabel(specs: ResourceSpecsStatus | null | undefined): string {
  if (!specs?.last_sync_at) {
    if (specs?.db_specs) {
      return `В БД ${specs.db_specs} спец. · ${specs.db_materials.toLocaleString("ru-RU")} мат., дата синхронизации неизвестна`;
    }
    return "Ещё не синхронизировалось";
  }
  const when = formatAveonDateTime(specs.last_sync_at);
  const specsCount = (specs.db_specs || specs.specs_count || 0).toLocaleString("ru-RU");
  const matsCount = (specs.db_materials || specs.materials_count || 0).toLocaleString("ru-RU");
  if (specs.status && specs.status !== "ok") {
    return `Последняя попытка: ${when} · ошибка`;
  }
  return `Последняя выгрузка из 1С: ${when} · ${specsCount} спец. · ${matsCount} мат.`;
}

function latestSyncAt(
  stock: StockStatus | null | undefined,
  specs: ResourceSpecsStatus | null | undefined,
  productionPlan?: ProductionPlanStatus | null,
): string | null {
  const dates = [stock?.last_sync_at, specs?.last_sync_at, productionPlan?.last_sync_at].filter(Boolean) as string[];
  if (!dates.length) return null;
  return dates.reduce((latest, current) =>
    new Date(current).getTime() > new Date(latest).getTime() ? current : latest,
  );
}

export function buildCombinedOnecFreshnessLabel(
  stock: StockStatus | null | undefined,
  specs: ResourceSpecsStatus | null | undefined,
  productionPlan?: ProductionPlanStatus | null,
): string {
  const stockFailed = Boolean(stock?.status && stock.status !== "ok");
  const specsFailed = Boolean(specs?.status && specs.status !== "ok");
  const planFailed = Boolean(productionPlan?.status && productionPlan.status !== "ok");
  const when = latestSyncAt(stock, specs, productionPlan);

  if (!when) {
    const stockCount = stock?.db_count ?? 0;
    const specsCount = specs?.db_specs ?? 0;
    const planCount = productionPlan?.db_count ?? 0;
    const errorDetail = stock?.error_message || specs?.error_message;
    if (stockFailed || specsFailed || planFailed) {
      const planError = productionPlan?.error_message;
      const rawError = errorDetail || planError;
      const sanitized = rawError ? sanitizeOnecErrorMessage(String(rawError)) : null;
      return sanitized
        ? `Ошибка синхронизации 1С: ${sanitized}`
        : "Ошибка синхронизации 1С";
    }
    if (stockCount || specsCount || planCount) {
      const parts: string[] = [];
      if (stockCount) parts.push(`${stockCount.toLocaleString("ru-RU")} поз.`);
      if (specsCount) {
        parts.push(`${specsCount.toLocaleString("ru-RU")} спец.`);
        if (specs?.db_materials) parts.push(`${specs.db_materials.toLocaleString("ru-RU")} мат.`);
      }
      if (planCount) parts.push(`план ${productionPlan?.plan_number || "—"} · ${planCount.toLocaleString("ru-RU")} стр.`);
      return `Последняя выгрузка из 1С · ${parts.join(" · ")}, дата неизвестна`;
    }
    return "Ещё не синхронизировалось";
  }

  if (stockFailed || specsFailed || planFailed) {
    const rawDetail = stock?.error_message || specs?.error_message || productionPlan?.error_message;
    const detail = rawDetail ? sanitizeOnecErrorMessage(rawDetail) : null;
    return detail
      ? `Ошибка синхронизации 1С: ${detail}`
      : `Последняя выгрузка из 1С: ${formatAveonDateTime(when)} · ошибка`;
  }

  const parts: string[] = [`Последняя выгрузка из 1С: ${formatAveonDateTime(when)}`];
  const posCount = stock?.db_count || stock?.saved_count || 0;
  if (posCount) parts.push(`${posCount.toLocaleString("ru-RU")} поз.`);
  const specsCount = specs?.db_specs || specs?.specs_count || 0;
  if (specsCount) parts.push(`${specsCount.toLocaleString("ru-RU")} спец.`);
  const matsCount = specs?.db_materials || specs?.materials_count || 0;
  if (matsCount) parts.push(`${matsCount.toLocaleString("ru-RU")} мат.`);
  const planCount = productionPlan?.db_count || productionPlan?.saved_count || 0;
  if (planCount) {
    parts.push(
      `план ${productionPlan?.plan_number || "—"} · ${planCount.toLocaleString("ru-RU")} стр.`
    );
  }

  return parts.join(" · ");
}

export type OnecManualSyncResult = {
  ok?: boolean;
  status?: string;
  stock?: { ok?: boolean; message?: string };
  resource_specs?: { ok?: boolean; message?: string };
  production_plan?: { ok?: boolean; message?: string };
};

export function sanitizeOnecErrorMessage(message: string | undefined): string {
  if (!message) return "ошибка";

  let text = message.trim();

  if (/ConnectTimeout|timed out|не отвечает/i.test(text)) {
    const host =
      text.match(/host='([^']+)'/i)?.[1] ??
      text.match(/(\d{1,3}(?:\.\d{1,3}){3})/)?.[1] ??
      "1С";
    return `Сервер ${host} не отвечает — проверьте VPN или сеть.`;
  }

  if (/ConnectionError|Connection refused|нет соединения/i.test(text)) {
    return "Нет соединения с сервером 1С.";
  }

  text = text
    .replace(/^Не удалось получить [^:]+ из 1С:\s*/i, "")
    .replace(/^Не удалось обновить[^.]*\.\s*/i, "")
    .replace(/HTTPConnectionPool\([^)]*\):\s*/gi, "")
    .replace(/Max retries exceeded with url:\s*\S+/gi, "нет ответа от сервера")
    .replace(/\(Caused by [^)]+\)/gi, "")
    .replace(/https?:\/\/\S+/gi, "…")
    .replace(/\/ERP2\/odata[^\s]*/gi, "…")
    .replace(/\s+/g, " ")
    .trim();

  if (!text || text === "…") {
    return "ошибка соединения с 1С";
  }

  if (text.length > 140) {
    return `${text.slice(0, 137)}…`;
  }

  return text;
}

export type OnecSyncStepView = {
  label: string;
  ok: boolean | null;
  message: string;
};

export type OnecManualSyncMessageView = {
  tone: "success" | "warning" | "error" | "info";
  title: string;
  steps: OnecSyncStepView[];
};

function buildOnecSyncStepView(
  label: string,
  step: { ok?: boolean; message?: string } | undefined,
): OnecSyncStepView {
  if (!step) {
    return { label, ok: null, message: "—" };
  }
  if (step.ok) {
    return { label, ok: true, message: "обновлено" };
  }
  return { label, ok: false, message: sanitizeOnecErrorMessage(step.message) };
}

export function parseOnecManualSyncMessage(result: OnecManualSyncResult): OnecManualSyncMessageView | null {
  if (result.ok) {
    return {
      tone: "success",
      title: "Выгрузка из 1С завершена успешно.",
      steps: [
        buildOnecSyncStepView("Остатки", result.stock),
        buildOnecSyncStepView("Спецификации", result.resource_specs),
        buildOnecSyncStepView("План", result.production_plan),
      ],
    };
  }

  if (result.status === "skipped_locked") {
    return {
      tone: "info",
      title: "Синхронизация уже выполняется — дождитесь завершения.",
      steps: [],
    };
  }

  const steps = [
    buildOnecSyncStepView("Остатки", result.stock),
    buildOnecSyncStepView("Спецификации", result.resource_specs),
    buildOnecSyncStepView("План", result.production_plan),
  ];
  const anyOk = steps.some((step) => step.ok === true);
  const allFailed = steps.every((step) => step.ok === false);

  return {
    tone: anyOk ? "warning" : "error",
    title: anyOk
      ? "Выгрузка частичная — для шагов с ошибкой в БД остаются данные от последней успешной синхронизации."
      : allFailed
        ? "Не удалось обновить данные из 1С. В БД остаются данные от последней успешной выгрузки."
        : "Не удалось выгрузить данные из 1С.",
    steps,
  };
}

export function buildOnecManualSyncMessage(result: OnecManualSyncResult): string {
  const view = parseOnecManualSyncMessage(result);
  if (!view) return "Не удалось выгрузить данные из 1С.";
  if (!view.steps.length) return view.title;

  const stepLines = view.steps
    .map((step) => {
      if (step.ok === true) return `${step.label}: ок`;
      if (step.ok === false) return `${step.label}: ${step.message}`;
      return `${step.label}: —`;
    })
    .join(". ");

  return `${view.title} ${stepLines}.`;
}

export type { StockStatus, ResourceSpecsStatus, ProductionPlanStatus };
