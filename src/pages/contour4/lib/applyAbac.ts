import type { Contour4AgentId, Contour4Widget } from "@/types/contour4";
import { filterRowsByCfoCode } from "../contour4Session";
import { asBool } from "./asBool";

export function applyAbacToWidgets(
  widgets: Contour4Widget[],
  agentId: Contour4AgentId,
  sessionRole: string,
  cfoCode?: string
): Contour4Widget[] {
  const session = { user_role: sessionRole, cfo_code: cfoCode };
  return widgets.map((w) => {
    if (w.type !== "table" || !w.data.rows) return w;

    if (agentId === "accountant" && w.id === "W-ACC-QUEUE") {
      return {
        ...w,
        data: {
          ...w.data,
          rows: w.data.rows.filter((r) => asBool(r.fully_approved))
        }
      };
    }

    if (agentId === "cfo_head") {
      const rows = filterRowsByCfoCode(w.data.rows, session, agentId);
      return { ...w, data: { ...w.data, rows } };
    }

    return w;
  });
}
