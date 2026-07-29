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
export const PRODUCTION_DISPATCHER_AGENT_SLUG = "production_dispatcher_agent";
export const PRODUCTION_DISPATCHER_AGENT_PATH = "/agents/production-dispatcher";
export const WAREHOUSE_PICKER_AGENT_SLUG = "warehouse_picker_agent";
export const WAREHOUSE_PICKER_AGENT_PATH = "/agents/warehouse-picker";
export const WAREHOUSE_COMPLEX_CHIEF_AGENT_SLUG = "warehouse_complex_chief_agent";
export const WAREHOUSE_COMPLEX_CHIEF_AGENT_PATH = "/agents/warehouse-complex-chief";
export const PURCHASE_MANAGER_AGENT_SLUG = "purchase_manager_agent";
export const PURCHASE_MANAGER_AGENT_PATH = "/agents/purchase-manager";
export const OMTO_SUPPORT_MANAGER_AGENT_SLUG = "omto_support_manager_agent";
export const OMTO_SUPPORT_MANAGER_AGENT_PATH = "/agents/omto-support-manager";
export const OTK_HEAD_AGENT_SLUG = "otk_head_agent";
export const OTK_HEAD_AGENT_PATH = "/agents/otk-head";
export const QUALITY_ENGINEER_AGENT_SLUG = "quality_engineer_agent";
export const QUALITY_ENGINEER_AGENT_PATH = "/agents/quality-engineer";
export const QUALITY_DEPUTY_DIRECTOR_AGENT_SLUG = "quality_deputy_director_agent";
export const QUALITY_DEPUTY_DIRECTOR_AGENT_PATH = "/agents/quality-deputy-director";
export const QUALITY_KPI_AGENT_SLUG = "quality_kpi_agent";
export const QUALITY_KPI_AGENT_PATH = "/agents/quality-kpi";
export const ESKD_AGENT_SLUG = "eskd_agent";
export const ESKD_AGENT_PATH = "/agents/eskd";
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

export function isProductionDispatcherAgent(
  agent: Pick<AgentAccess, "slug">
): boolean {
  return agent.slug === PRODUCTION_DISPATCHER_AGENT_SLUG;
}

export function isWarehousePickerAgent(
  agent: Pick<AgentAccess, "slug">
): boolean {
  return agent.slug === WAREHOUSE_PICKER_AGENT_SLUG;
}

export function isWarehouseComplexChiefAgent(
  agent: Pick<AgentAccess, "slug">
): boolean {
  return agent.slug === WAREHOUSE_COMPLEX_CHIEF_AGENT_SLUG;
}

/** Role badge when several agents share the display name «ИИ-агент по закупкам». */
export function getAgentRoleBadge(
  agent: Pick<AgentAccess, "slug">
): string | null {
  if (isProcurementAgent(agent)) return "Оркестратор";
  if (isWarehouseComplexChiefAgent(agent)) return "Начальник складского комплекса";
  return null;
}

export function isPurchaseManagerAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === PURCHASE_MANAGER_AGENT_SLUG;
}

export function isOmtoSupportManagerAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === OMTO_SUPPORT_MANAGER_AGENT_SLUG;
}

export function isOtkHeadAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === OTK_HEAD_AGENT_SLUG;
}

export function isQualityEngineerAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === QUALITY_ENGINEER_AGENT_SLUG;
}

export function isQualityDeputyDirectorAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === QUALITY_DEPUTY_DIRECTOR_AGENT_SLUG;
}

export function isQualityKpiAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === QUALITY_KPI_AGENT_SLUG;
}

export function isEskdAgent(agent: Pick<AgentAccess, "slug">): boolean {
  return agent.slug === ESKD_AGENT_SLUG || agent.slug === "eskd-agent";
}

export function hasDedicatedLaunchPage(agent: Pick<AgentAccess, "slug">): boolean {
  return (
    isNdControlAgent(agent) ||
    isMeetingAgent(agent) ||
    isTasksAgent(agent) ||
    isIncomingCorrespondenceAgent(agent) ||
    isProductionDispatcherAgent(agent) ||
    isWarehousePickerAgent(agent) ||
    isWarehouseComplexChiefAgent(agent) ||
    isPurchaseManagerAgent(agent) ||
    isOmtoSupportManagerAgent(agent) ||
    isOtkHeadAgent(agent) ||
    isQualityEngineerAgent(agent) ||
    isQualityDeputyDirectorAgent(agent) ||
    isQualityKpiAgent(agent) ||
    isEskdAgent(agent) ||
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
  if (isProductionDispatcherAgent(agent)) {
    return {
      path: PRODUCTION_DISPATCHER_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isWarehousePickerAgent(agent)) {
    return {
      path: WAREHOUSE_PICKER_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isWarehouseComplexChiefAgent(agent)) {
    return {
      path: WAREHOUSE_COMPLEX_CHIEF_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isPurchaseManagerAgent(agent)) {
    return {
      path: PURCHASE_MANAGER_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isOmtoSupportManagerAgent(agent)) {
    return {
      path: OMTO_SUPPORT_MANAGER_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isOtkHeadAgent(agent)) {
    return {
      path: OTK_HEAD_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isQualityEngineerAgent(agent)) {
    return {
      path: QUALITY_ENGINEER_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isQualityDeputyDirectorAgent(agent)) {
    return {
      path: QUALITY_DEPUTY_DIRECTOR_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isQualityKpiAgent(agent)) {
    return {
      path: QUALITY_KPI_AGENT_PATH,
      state: { from: "agent-launch" as const }
    };
  }
  if (isEskdAgent(agent)) {
    return {
      path: ESKD_AGENT_PATH,
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
