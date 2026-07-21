import type { Contour4Notification, KpiStatus } from "@/types/contour4";

type CssBag = Record<string, string>;

/** Pick CSS module class from a status→class map (avoids nested ternaries). */
export function statusClass<K extends string>(
  map: Partial<Record<K, string>> & { default: string },
  key: K | undefined | null
): string {
  if (key != null && map[key]) return map[key] as string;
  return map.default;
}

export function kpiStatusClassMap(styles: CssBag): Record<KpiStatus, string> {
  return {
    ok: styles.kpiStatusOk,
    border: styles.kpiStatusBorder,
    below: styles.kpiStatusBelow
  };
}

export function kpiProgressClassMap(styles: CssBag): Record<KpiStatus, string> {
  return {
    ok: styles.progressBar,
    border: styles.progressBorder,
    below: styles.progressBelow
  };
}

export function notifyTypeClassMap(
  styles: CssBag
): Partial<Record<Contour4Notification["type"], string>> & { default: string } {
  return {
    hitl: styles.nTypeHitl,
    escalation: styles.nTypeEscalation,
    default: styles.nType
  };
}

export function timelineStatusClassMap(
  styles: CssBag
): Partial<Record<"ok" | "warn" | "bad" | "pending", string>> & {
  default: string;
} {
  return {
    ok: styles.tlOk,
    warn: styles.tlBad,
    bad: styles.tlBad,
    pending: styles.tlPending,
    default: styles.tlPending
  };
}
