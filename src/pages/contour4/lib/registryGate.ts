import type { Contour4Widget } from "@/types/contour4";
import { isRegistryLineBlocked } from "../contour4Session";

/** True if executive registry widget has any line without CFO approval. */
export function registryHasBlockedLines(widgets: Contour4Widget[]): boolean {
  const lines = widgets.find((w) => w.id === "W-EXEC-LINES");
  return (lines?.data.rows ?? []).some((r) => isRegistryLineBlocked(r));
}
