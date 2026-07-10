import type { NavigateFunction } from "react-router-dom";
import type { AgentAccess } from "@/types";

export const ND_CONTROL_AGENT_SLUG = "nd_control_agent";
export const ND_CONTROL_AGENT_PATH = "/agents/nd-control";
export const MEETING_AGENT_SLUG = "meeting_agent";
export const MEETING_AGENT_PATH = "/agents/meeting";
export const TASKS_AGENT_SLUG = "tasks_agent";
export const TASKS_AGENT_PATH = "/agents/tasks";
export const WAREHOUSE_AGENT_SLUG = "warehouse_agent";
export const WAREHOUSE_AGENT_PATH = "/agents/warehouse";
export const PRICING_AGENT_SLUG = "pricing_agent";
export const PRICING_AGENT_PATH = "/agents/pricing";

import type { PricingStageRouteId } from "@/utils/pricingStageNavigation";

export const PRICING_STAGE_SLUGS: Record<PricingStageRouteId, string> = {
  invoice: "schet",
  project_price: "proektnaya-cena",
  monitoring: "monitoring",
  contract: "dogovor",
  payment_request: "zayavka-oplaty",
  payment: "oplata",
  settlement: "vzaimoraschety",
  completed: "zavershenie"
};

export function getPricingStagePath(stageId: PricingStageRouteId, invoiceId?: string): string {
  const stageSlug = PRICING_STAGE_SLUGS[stageId];
  const base = `${PRICING_AGENT_PATH}/${stageSlug}`;
  if (!invoiceId) return base;
  return `${base}?invoice=${encodeURIComponent(invoiceId)}`;
}

export function getPricingStageIdBySlug(stageSlug: string): PricingStageRouteId | null {
  const entry = Object.entries(PRICING_STAGE_SLUGS).find(([, slug]) => slug === stageSlug);
  return entry ? (entry[0] as PricingStageRouteId) : null;
}

/** @deprecated Используйте getPricingStagePath("invoice", invoiceId) */
export function getPricingInvoiceStagePath(invoiceId: string): string {
  return getPricingStagePath("invoice", invoiceId);
}
export const INCOMING_CORRESPONDENCE_AGENT_SLUG = "incoming_correspondence_agent";
export const INCOMING_CORRESPONDENCE_AGENT_PATH = "/agents";
export const AGENT_LAUNCH_MORPH_MS = 520;

export function isNdControlAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === ND_CONTROL_AGENT_SLUG;
}

export function isMeetingAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === MEETING_AGENT_SLUG;
}

export function isTasksAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === TASKS_AGENT_SLUG;
}

export function isWarehouseAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === WAREHOUSE_AGENT_SLUG;
}

export function isPricingAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === PRICING_AGENT_SLUG;
}

export function isIncomingCorrespondenceAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === INCOMING_CORRESPONDENCE_AGENT_SLUG;
}

export function hasDedicatedLaunchPage(agent: Pick<AgentAccess, "slug">): boolean {
  return (
    isNdControlAgent(agent) ||
    isMeetingAgent(agent) ||
    isTasksAgent(agent) ||
    isWarehouseAgent(agent) ||
    isPricingAgent(agent) ||
    isIncomingCorrespondenceAgent(agent)
  );
}

export function getAgentLaunchTarget(agent: Pick<AgentAccess, "slug" | "id" | "name">) {
  if (isNdControlAgent(agent)) {
    return {
      path: ND_CONTROL_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isMeetingAgent(agent)) {
    return {
      path: MEETING_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isTasksAgent(agent)) {
    return {
      path: TASKS_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isWarehouseAgent(agent)) {
    return {
      path: WAREHOUSE_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isPricingAgent(agent)) {
    return {
      path: PRICING_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isIncomingCorrespondenceAgent(agent)) {
    return {
      path: INCOMING_CORRESPONDENCE_AGENT_PATH,
      state: { from: "agent-launch" as const, agentId: agent.id, agentName: agent.name }
    };
  }
  return {
    path: "/tasks",
    state: { agentId: agent.id, agentName: agent.name }
  };
}

export function navigateToAgentLaunch(
  navigate: NavigateFunction,
  agent: Pick<AgentAccess, "slug" | "id" | "name">
) {
  const target = getAgentLaunchTarget(agent);
  const useTransition = isNdControlAgent(agent) && typeof document.startViewTransition === "function";

  const go = () => navigate(target.path, { state: target.state });

  if (useTransition) {
    document.documentElement.dataset.agentLaunch = "active";
    document.startViewTransition(() => {
      go();
    }).finished.finally(() => {
      delete document.documentElement.dataset.agentLaunch;
    });
    return;
  }

  go();
}
