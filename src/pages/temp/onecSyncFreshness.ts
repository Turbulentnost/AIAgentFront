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

function latestSyncAt(stock: StockStatus | null | undefined, specs: ResourceSpecsStatus | null | undefined): string | null {
  const dates = [stock?.last_sync_at, specs?.last_sync_at].filter(Boolean) as string[];
  if (!dates.length) return null;
  return dates.reduce((latest, current) =>
    new Date(current).getTime() > new Date(latest).getTime() ? current : latest,
  );
}

export function buildCombinedOnecFreshnessLabel(
  stock: StockStatus | null | undefined,
  specs: ResourceSpecsStatus | null | undefined,
): string {
  const stockFailed = Boolean(stock?.status && stock.status !== "ok");
  const specsFailed = Boolean(specs?.status && specs.status !== "ok");
  const when = latestSyncAt(stock, specs);

  if (!when) {
    const stockCount = stock?.db_count ?? 0;
    const specsCount = specs?.db_specs ?? 0;
    const errorDetail = stock?.error_message || specs?.error_message;
    if (stockFailed || specsFailed) {
      return errorDetail
        ? `Ошибка синхронизации 1С: ${errorDetail}`
        : "Ошибка синхронизации 1С";
    }
    if (stockCount || specsCount) {
      const parts: string[] = [];
      if (stockCount) parts.push(`${stockCount.toLocaleString("ru-RU")} поз.`);
      if (specsCount) {
        parts.push(`${specsCount.toLocaleString("ru-RU")} спец.`);
        if (specs?.db_materials) parts.push(`${specs.db_materials.toLocaleString("ru-RU")} мат.`);
      }
      return `Последняя выгрузка из 1С · ${parts.join(" · ")}, дата неизвестна`;
    }
    return "Ещё не синхронизировалось";
  }

  if (stockFailed || specsFailed) {
    const detail = stock?.error_message || specs?.error_message;
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

  return parts.join(" · ");
}

export type { StockStatus, ResourceSpecsStatus };
