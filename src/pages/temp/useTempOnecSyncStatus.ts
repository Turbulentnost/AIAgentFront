/**
 * TEMP(Aveon) — загрузка статуса синхронизации 1С для подписей в UI.
 * Опрашивает backend периодически, чтобы подпись обновлялась после фоновой выгрузки.
 */
import { useCallback, useEffect, useState } from "react";
import { agentsApi } from "@/api/endpoints";
import type { ProductionPlanStatus, ResourceSpecsStatus, StockStatus } from "./onecSyncFreshness";

const POLL_INTERVAL_MS = 60_000;

export function useTempOnecSyncStatus(refreshToken = 0) {
  const [stock, setStock] = useState<StockStatus | null>(null);
  const [specs, setSpecs] = useState<ResourceSpecsStatus | null>(null);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const result = await agentsApi.getAveonOnecSyncStatus();
      setStock(result.stock ?? null);
      setSpecs(result.resource_specs ?? null);
      setProductionPlan(result.production_plan ?? null);
    } catch {
      if (!options?.silent) {
        setStock(null);
        setSpecs(null);
        setProductionPlan(null);
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void reload({ silent: refreshToken > 0 });
  }, [reload, refreshToken]);

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void reload({ silent: true });
    };

    const intervalId = window.setInterval(tick, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void reload({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reload]);

  return { stock, specs, productionPlan, loading, reload };
}
