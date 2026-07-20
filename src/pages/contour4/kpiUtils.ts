import { CONTOUR4_COMMON_KPIS } from "@/mock-data/contour4";
import type {
  Contour4AgentMock,
  Contour4Kpi,
  Contour4KpiSummary,
  KpiStatus
} from "@/types/contour4";

export function buildKpis(agent: Contour4AgentMock): Contour4Kpi[] {
  return [...agent.specialKpis, ...CONTOUR4_COMMON_KPIS];
}

export function kpiStatus(kpi: Contour4Kpi): KpiStatus {
  const v = Number(kpi.value);
  const t = Number(kpi.targetNum);
  if (kpi.direction === "eq") {
    return v === t ? "ok" : "below";
  }
  if (kpi.direction === "lte") {
    if (v <= t * 0.8) return "ok";
    if (v <= t) return "border";
    return "below";
  }
  if (v >= t) return "ok";
  if (v >= t * 0.97) return "border";
  return "below";
}

export function statusLabel(st: KpiStatus): string {
  if (st === "ok") return "Достигнут";
  if (st === "border") return "На границе";
  return "Ниже цели";
}

export function formatKpiValue(kpi: Contour4Kpi): string {
  if (kpi.unit === "%") return `${kpi.value}%`;
  return String(kpi.value);
}

export function progressPct(kpi: Contour4Kpi): number {
  const v = Number(kpi.value);
  const t = Number(kpi.targetNum) || 1;
  if (kpi.direction === "eq") return v === t ? 100 : 0;
  if (kpi.direction === "lte") {
    if (t === 0) return v === 0 ? 100 : 0;
    return Math.max(0, Math.min(100, (1 - v / (t * 1.5)) * 100));
  }
  return Math.max(0, Math.min(100, (v / t) * 100));
}

export function summarizeKpis(kpis: Contour4Kpi[]): Contour4KpiSummary {
  let ok = 0;
  let border = 0;
  let below = 0;
  let blocking = 0;
  for (const k of kpis) {
    const st = kpiStatus(k);
    if (st === "ok") ok += 1;
    else if (st === "border") border += 1;
    else below += 1;
    if (k.blocking && st !== "ok") blocking += 1;
  }
  const total = kpis.length;
  const pct = total ? Math.round((ok / total) * 100) : 0;
  return { ok, border, below, blocking, total, pct, guardrail: 0 };
}
