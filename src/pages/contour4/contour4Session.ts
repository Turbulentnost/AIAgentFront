import type { Contour4AgentId, Contour4SessionRole } from "@/types/contour4";

const STORAGE_KEY = "contour4_session_role";

/** Stub session until Keycloak: default matches opened agent for demo. */
export function getContour4Session(fallbackRole?: Contour4AgentId): Contour4SessionRole {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Contour4SessionRole;
      if (parsed?.user_role) return parsed;
    }
  } catch {
    /* ignore */
  }
  return {
    user_role: fallbackRole ?? "executive_director",
    cfo_code: "CFO-12"
  };
}

export function setContour4Session(session: Contour4SessionRole): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function canViewHitlSensitive(
  session: Contour4SessionRole,
  assigneeRole: string
): boolean {
  return session.user_role === assigneeRole || session.user_role === "*";
}

/** ABAC: CFO head sees only own cfo_code rows when claim is set. */
export function filterRowsByCfoCode<T extends { cfo_code?: string | null }>(
  rows: T[],
  session: Contour4SessionRole,
  agentId: Contour4AgentId
): T[] {
  if (agentId !== "cfo_head" || !session.cfo_code) return rows;
  return rows.filter((row) => !row.cfo_code || row.cfo_code === session.cfo_code);
}

export function isRegistryLineBlocked(
  row: Record<string, string | number | boolean | null | undefined>
): boolean {
  const approved = row.cfo_approved;
  return approved === false || approved === "false" || approved === 0;
}
