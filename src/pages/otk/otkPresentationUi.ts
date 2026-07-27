/** Client-side check marks, due urgency, and list filter/sort for OTK worker UI. */

import type { OtkPresentationStatus } from "@/types/otk";

export type OtkListFilter = "all" | "needs_check" | "overdue" | "queued";
export type OtkListSort = "in_work" | "urgency";

export type PresentationCheckMark = "passed" | "needs_check" | "done_muted";
export type LineCheckMark = "passed" | "needs_check";

export type OtkListItemLike = {
  id: string;
  due_at: string;
  status: OtkPresentationStatus;
  /** Precomputed on list summary from backend. */
  all_accepted?: boolean;
  /** Detail card lines; used when all_accepted is absent. */
  lines?: Array<{ accepted?: boolean }>;
};

/** Hours until due; negative if overdue. */
export function hoursUntilDue(dueAt: string, nowMs = Date.now()): number | null {
  const t = Date.parse(dueAt);
  if (Number.isNaN(t)) return null;
  return (t - nowMs) / 3_600_000;
}

/**
 * Urgency 0..1 for orange→red gradient.
 * ≥7d → ~0; ~48h → mid; due now → high; overdue → critical.
 */
export function urgencyFactor(dueAt: string, nowMs = Date.now()): number {
  const h = hoursUntilDue(dueAt, nowMs);
  if (h === null) return 0;
  if (h >= 168) return 0.05;
  if (h >= 0) {
    return 0.08 + 0.64 * (1 - h / 168);
  }
  return Math.min(1, 0.72 + 0.28 * Math.min(1, -h / 48));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mixRgb(
  c0: readonly [number, number, number],
  c1: readonly [number, number, number],
  t: number
): string {
  const u = Math.min(1, Math.max(0, t));
  const r = Math.round(lerp(c0[0], c1[0], u));
  const g = Math.round(lerp(c0[1], c1[1], u));
  const b = Math.round(lerp(c0[2], c1[2], u));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Smooth orange → red by remaining time. Done cards stay readable but slightly muted. */
export function urgencyColor(
  dueAt: string,
  opts?: { nowMs?: number; muted?: boolean }
): string {
  const t = urgencyFactor(dueAt, opts?.nowMs);
  // mild orange → orange → crimson (strong contrast, no pale pastels)
  const mild: [number, number, number] = [194, 65, 12]; // #c2410c
  const mid: [number, number, number] = [234, 88, 12]; // #ea580c
  const crit: [number, number, number] = [185, 28, 28]; // #b91c1c
  const color = t < 0.5 ? mixRgb(mild, mid, t / 0.5) : mixRgb(mid, crit, (t - 0.5) / 0.5);
  if (!opts?.muted) return color;
  return `color-mix(in srgb, ${color} 70%, #64748b)`;
}

export function isOverdue(dueAt: string, nowMs = Date.now()): boolean {
  const h = hoursUntilDue(dueAt, nowMs);
  return h !== null && h < 0;
}

/**
 * All line acceptances closed.
 * No lines → false (caller should follow status via isEffectivelyCompleted).
 * Has lines → every line accepted.
 * List summaries may pass `all_accepted` instead of lines.
 */
export function isFullyAccepted(card: {
  lines?: Array<{ accepted?: boolean }> | null;
  all_accepted?: boolean;
}): boolean {
  if (Array.isArray(card.lines)) {
    if (card.lines.length === 0) return false;
    return card.lines.every((line) => Boolean(line.accepted));
  }
  return Boolean(card.all_accepted);
}

/** Status done OR every acceptance closed. */
export function isEffectivelyCompleted(item: {
  status: OtkPresentationStatus;
  lines?: Array<{ accepted?: boolean }> | null;
  all_accepted?: boolean;
}): boolean {
  return item.status === "done" || isFullyAccepted(item);
}

export function presentationCheckMark(
  item:
    | OtkPresentationStatus
    | {
        status: OtkPresentationStatus;
        lines?: Array<{ accepted?: boolean }> | null;
        all_accepted?: boolean;
      }
): PresentationCheckMark {
  if (typeof item === "string") {
    return item === "done" ? "done_muted" : "needs_check";
  }
  return isEffectivelyCompleted(item) ? "done_muted" : "needs_check";
}

export function lineCheckMark(accepted?: boolean): LineCheckMark {
  return accepted ? "passed" : "needs_check";
}

export function matchesListFilter(
  item: OtkListItemLike,
  filter: OtkListFilter,
  nowMs = Date.now()
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "needs_check":
      return !isEffectivelyCompleted(item);
    case "overdue":
      return isOverdue(item.due_at, nowMs) && !isEffectivelyCompleted(item);
    case "queued":
      return item.status === "queued" && !isEffectivelyCompleted(item);
    default:
      return true;
  }
}

/** Most urgent first = earliest due / overdue first. Completed last. */
export function compareByUrgency(a: OtkListItemLike, b: OtkListItemLike): number {
  const ca = isEffectivelyCompleted(a) ? 1 : 0;
  const cb = isEffectivelyCompleted(b) ? 1 : 0;
  if (ca !== cb) return ca - cb;
  const ta = Date.parse(a.due_at);
  const tb = Date.parse(b.due_at);
  const aOk = !Number.isNaN(ta);
  const bOk = !Number.isNaN(tb);
  if (aOk && bOk && ta !== tb) return ta - tb;
  if (aOk !== bOk) return aOk ? -1 : 1;
  return a.id.localeCompare(b.id);
}

/** 0 = in_progress, 1 = queued/other active, 2 = completed. */
function workBucket(item: OtkListItemLike): number {
  if (isEffectivelyCompleted(item)) return 2;
  if (item.status === "in_progress") return 0;
  return 1;
}

/** In progress first, then queued/needs check, then completed — urgency within group. */
export function compareByInWork(a: OtkListItemLike, b: OtkListItemLike): number {
  const d = workBucket(a) - workBucket(b);
  if (d !== 0) return d;
  return compareByUrgency(a, b);
}

export function filterAndSortPresentations<T extends OtkListItemLike>(
  items: T[],
  filter: OtkListFilter,
  sort: OtkListSort,
  nowMs = Date.now()
): T[] {
  const filtered = items.filter((item) => matchesListFilter(item, filter, nowMs));
  const cmp = sort === "urgency" ? compareByUrgency : compareByInWork;
  return [...filtered].sort(cmp);
}
