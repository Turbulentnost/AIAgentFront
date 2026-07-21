import { useMemo } from "react";
import { CONTOUR4_AGENTS, isContour4AgentId } from "@/mock-data/contour4";
import type { Contour4SessionRole } from "@/types/contour4";
import { canViewHitlSensitive } from "../contour4Session";
import { applyAbacToWidgets } from "../lib/applyAbac";
import { registryHasBlockedLines } from "../lib/registryGate";
import { buildKpis, summarizeKpis } from "../kpiUtils";

export function useContour4WorkspaceModel(
  agentId: string,
  session: Contour4SessionRole
) {
  const agent = isContour4AgentId(agentId) ? CONTOUR4_AGENTS[agentId] : null;

  const kpis = useMemo(() => (agent ? buildKpis(agent) : []), [agent]);
  const sum = useMemo(() => summarizeKpis(kpis), [kpis]);

  const widgets = useMemo(() => {
    if (!agent) return [];
    return applyAbacToWidgets(
      agent.widgets,
      agent.id,
      session.user_role,
      session.cfo_code
    );
  }, [agent, session.cfo_code, session.user_role]);

  const canViewSensitive = agent
    ? canViewHitlSensitive(session, agent.hitl.assignee_role)
    : false;

  const blockApproveRegistry = useMemo(() => {
    if (!agent || agent.id !== "executive_director") return false;
    return registryHasBlockedLines(agent.widgets);
  }, [agent]);

  const unread = agent
    ? agent.notifications.filter((n) => n.unread).length
    : 0;

  return {
    agent,
    kpis,
    sum,
    widgets,
    canViewSensitive,
    blockApproveRegistry,
    unread
  };
}
