/**
 * Кэш справочных данных Авион — загрузка один раз при открытии агента.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { agentsApi } from "@/api/endpoints";
import type { GoogleSheetTab } from "./TempGoogleSheetsViewer";

export type ProductionPlanCache = Awaited<ReturnType<typeof agentsApi.tempAveonProductionPlan>>;

export type GoogleSheetsCache = {
  ok: boolean;
  sheetTitle: string;
  spreadsheetTitle: string | null;
  values: string[][];
  sheets: GoogleSheetTab[];
  preferredSheetIndex: number;
  error: string | null;
};

export type RussiaShipmentCache = {
  ok: boolean;
  fileName: string;
  values: string[][];
  updatedAt: string | null;
  error: string | null;
};

export type ResourceSpecSummary = {
  ref_key: string;
  code: string;
  description: string;
  status: string;
  main_product_name: string;
  materials_count: number;
};

export type ResourceSpecDetail = NonNullable<
  Awaited<ReturnType<typeof agentsApi.getAveonResourceSpec>>["spec"]
>;

export type ResourceSpecsCache = {
  ok: boolean;
  items: ResourceSpecSummary[];
  details: Record<string, ResourceSpecDetail>;
  error: string | null;
};

export type StockBalancesCache = {
  ok: boolean;
  total: number;
  totalAll?: number;
  specMaterialsOnly?: boolean;
  specNomenclatureCount?: number;
  syncedAt: string | null;
  items: Array<{
    code: string;
    name: string;
    warehouse: string;
    in_stock: number;
    to_ship: number;
    available: number;
    nomenclature_key?: string;
  }>;
  error: string | null;
};

export type ReferenceCacheState = {
  productionPlan: ProductionPlanCache | null;
  googleSheets: GoogleSheetsCache | null;
  russiaShipment: RussiaShipmentCache | null;
  resourceSpecs: ResourceSpecsCache | null;
  stockBalances: StockBalancesCache | null;
  loading: boolean;
  loaded: boolean;
  errors: string[];
};

const INITIAL: ReferenceCacheState = {
  productionPlan: null,
  googleSheets: null,
  russiaShipment: null,
  resourceSpecs: null,
  stockBalances: null,
  loading: false,
  loaded: false,
  errors: [],
};

async function loadProductionPlan(): Promise<ProductionPlanCache> {
  return agentsApi.tempAveonProductionPlan();
}

async function loadGoogleSheets(): Promise<GoogleSheetsCache> {
  try {
    const result = await agentsApi.fetchAveonGoogleSheets();
    const parsed = result.parsed;
    const rawSheets = parsed?.sheets ?? [];
    const sheets: GoogleSheetTab[] = rawSheets
      .filter((sheet) => sheet.ok !== false)
      .map((sheet) => ({
        title: sheet.title,
        gid: sheet.gid ?? null,
        rowCount: sheet.row_count ?? sheet.values?.length ?? 0,
        columnCount: sheet.column_count ?? 0,
        values: sheet.values ?? [],
        error: sheet.error ?? null,
      }))
      .filter((sheet) => sheet.values.length > 0 || sheet.error);

    const preferredTitle =
      parsed?.preferred_sheet_title || parsed?.sheet_title || result.sheet_title || "ИТЦ В РАБОТЕ";
    let preferredSheetIndex = sheets.findIndex((sheet) => sheet.title === preferredTitle);
    if (preferredSheetIndex < 0) {
      preferredSheetIndex = 0;
    }

    if (!sheets.length && (parsed?.values?.length ?? 0) > 0) {
      sheets.push({
        title: preferredTitle,
        gid: parsed?.sheet_gid ?? null,
        rowCount: parsed?.row_count ?? parsed?.values?.length ?? 0,
        columnCount: parsed?.column_count ?? 0,
        values: parsed?.values ?? [],
      });
      preferredSheetIndex = 0;
    }

    const values = sheets[preferredSheetIndex]?.values ?? parsed?.values ?? [];
    return {
      ok: result.ok && values.length > 0,
      sheetTitle: sheets[preferredSheetIndex]?.title || preferredTitle,
      spreadsheetTitle: parsed?.spreadsheet_title ?? null,
      values,
      sheets,
      preferredSheetIndex,
      error: values.length ? null : "Лист пуст или данные не пришли",
    };
  } catch {
    return {
      ok: false,
      sheetTitle: "ИТЦ В РАБОТЕ",
      spreadsheetTitle: null,
      values: [],
      sheets: [],
      preferredSheetIndex: 0,
      error: "Не удалось загрузить лист Google Sheets",
    };
  }
}

async function loadRussiaShipment(): Promise<RussiaShipmentCache> {
  try {
    const result = await agentsApi.getCurrentRussiaShipmentSchedule();
    const schedule = result.schedule;
    if (!schedule) {
      return {
        ok: false,
        fileName: "",
        values: [],
        updatedAt: null,
        error: "Российский график отгрузок не загружен в БД",
      };
    }
    return {
      ok: true,
      fileName: schedule.file_name || "График России",
      values: schedule.preview_values ?? [],
      updatedAt: schedule.updated_at ?? schedule.created_at ?? null,
      error: null,
    };
  } catch {
    return {
      ok: false,
      fileName: "",
      values: [],
      updatedAt: null,
      error: "Не удалось загрузить график России из БД",
    };
  }
}

async function loadResourceSpecs(): Promise<ResourceSpecsCache> {
  try {
    const list = await agentsApi.listAveonResourceSpecs({ limit: 500 });
    const items = list.items ?? [];
    const details: Record<string, ResourceSpecDetail> = {};
    const batchSize = 8;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((item) => agentsApi.getAveonResourceSpec(item.ref_key))
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.spec) {
          details[result.value.spec.ref_key] = result.value.spec;
        }
      }
    }
    return { ok: true, items, details, error: null };
  } catch {
    return { ok: false, items: [], details: {}, error: "Не удалось загрузить спецификации из БД" };
  }
}

async function loadStockBalances(): Promise<StockBalancesCache> {
  try {
    const result = await agentsApi.listAveonStockBalances({
      limit: 10000,
      spec_materials_only: true,
    });
    return {
      ok: true,
      total: result.total,
      totalAll: result.total_all,
      specMaterialsOnly: result.spec_materials_only,
      specNomenclatureCount: result.spec_nomenclature_count,
      syncedAt: result.synced_at ?? null,
      items: result.items,
      error: null,
    };
  } catch (error) {
    let message = "Не удалось загрузить остатки из БД";
    if (isAxiosError(error)) {
      if (error.response?.status === 404) {
        message = "Сервис остатков недоступен — перезапустите backend";
      } else if (typeof error.response?.data?.detail === "string") {
        message = error.response.data.detail;
      }
    }
    return {
      ok: false,
      total: 0,
      syncedAt: null,
      items: [],
      error: message,
    };
  }
}

export function useAveonReferenceCache(refreshToken = 0) {
  const [state, setState] = useState<ReferenceCacheState>(INITIAL);
  const inFlightRef = useRef(false);

  const preload = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setState((prev) => ({ ...prev, loading: true, errors: [] }));

    const [
      productionPlan,
      googleSheets,
      russiaShipment,
      resourceSpecs,
      stockBalances,
    ] = await Promise.all([
      loadProductionPlan().catch(() => null),
      loadGoogleSheets(),
      loadRussiaShipment(),
      loadResourceSpecs(),
      loadStockBalances(),
    ]);

    const errors: string[] = [];
    if (!productionPlan?.ok) errors.push("годовой график");
    if (!googleSheets.ok) errors.push("ИТЦ В РАБОТЕ");
    if (!russiaShipment.ok) errors.push("график России");
    if (!resourceSpecs.ok) errors.push("спецификации");
    if (!stockBalances.ok) errors.push("остатки");

    setState({
      productionPlan,
      googleSheets,
      russiaShipment,
      resourceSpecs,
      stockBalances,
      loading: false,
      loaded: true,
      errors,
    });
    inFlightRef.current = false;
  }, []);

  useEffect(() => {
    void preload();
  }, [preload, refreshToken]);

  return { ...state, reload: preload };
}
