import type { NavigateFunction } from "react-router-dom";
import type { AgentAccess } from "@/types";

export const ND_CONTROL_AGENT_SLUG = "nd_control_agent";
export const ND_CONTROL_AGENT_PATH = "/agents/nd-control";
export const MEETING_AGENT_SLUG = "meeting_agent";
export const MEETING_AGENT_PATH = "/agents/meeting";
export const TASKS_AGENT_SLUG = "tasks_agent";
export const TASKS_AGENT_PATH = "/agents/tasks";
export const INCOMING_CORRESPONDENCE_AGENT_SLUG = "incoming_correspondence_agent";
export const INCOMING_CORRESPONDENCE_AGENT_PATH = "/agents/incoming-mail";
export const PROCUREMENT_AGENT_SLUG = "procurement_logistics_agent";
export const PROCUREMENT_AGENT_PATH = "/agents/procurement";
export const PRODUCTION_PREPARATION_ENGINEER_AGENT_SLUG =
  "production_preparation_engineer_agent";
export const PRODUCTION_PREPARATION_ENGINEER_AGENT_PATH =
  "/agents/production-preparation-engineer";
export const OMTO_SUPPORT_MANAGER_AGENT_SLUG = "omto_support_manager_agent";
export const OMTO_SUPPORT_MANAGER_AGENT_PATH = "/agents/omto-support-manager";
export const AGENT_LAUNCH_MORPH_MS = 520;

function agentKey(agent: Pick<AgentAccess, "slug"> & Partial<Pick<AgentAccess, "name" | "purpose">>): string {
  return `${agent.slug} ${agent.name ?? ""} ${agent.purpose ?? ""}`.toLowerCase();
}

export function isNdControlAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === ND_CONTROL_AGENT_SLUG;
}

export function isMeetingAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === MEETING_AGENT_SLUG;
}

export function isTasksAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === TASKS_AGENT_SLUG;
}

export function isIncomingCorrespondenceAgent(
  agent: Pick<AgentAccess, "slug"> & Partial<Pick<AgentAccess, "name" | "purpose">>
): boolean {
  const key = agentKey(agent);
  return (
    agent.slug === INCOMING_CORRESPONDENCE_AGENT_SLUG ||
    agent.slug === "agent_pochta" ||
    agent.slug === "incoming-mail" ||
    agent.slug === "incoming_mail" ||
    /pochta|incoming.?mail|входящ.*корресп|корреспонденц/.test(key)
  );
}

export function isProcurementAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === PROCUREMENT_AGENT_SLUG;
}

export function isProductionPreparationEngineerAgent(
  agent: Pick<AgentAccess, "slug">
): boolean {
  return agent.slug === PRODUCTION_PREPARATION_ENGINEER_AGENT_SLUG;
}

export function isOmtoSupportManagerAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === OMTO_SUPPORT_MANAGER_AGENT_SLUG;
}

export function hasDedicatedLaunchPage(agent: Pick<AgentAccess, "slug">): boolean {
  return (
    isNdControlAgent(agent) ||
    isMeetingAgent(agent) ||
    isTasksAgent(agent) ||
    isIncomingCorrespondenceAgent(agent) ||
    isProductionPreparationEngineerAgent(agent) ||
    isOmtoSupportManagerAgent(agent) ||
    isProcurementAgent(agent)
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
  if (isIncomingCorrespondenceAgent(agent)) {
    return {
      path: INCOMING_CORRESPONDENCE_AGENT_PATH,
      state: { from: "agent-launch" as const, agentId: agent.id, agentName: agent.name }
    };
  }
  if (isProductionPreparationEngineerAgent(agent)) {
    return {
      path: PRODUCTION_PREPARATION_ENGINEER_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isOmtoSupportManagerAgent(agent)) {
    return {
      path: OMTO_SUPPORT_MANAGER_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isProcurementAgent(agent)) {
    return {
      path: PROCUREMENT_AGENT_PATH,
      state: { from: "agent-launch" as const }
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
  if (isIncomingCorrespondenceAgent(agent)) {
    window.location.assign(target.path);
    return;
  }
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
