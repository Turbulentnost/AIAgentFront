import { mockDocumentAnalysisAgent } from "@/mock-data/documentAnalysisAgent";
import { mockPricingAgent } from "@/mock-data/pricingAgent";
import { mockWarehouseAgent } from "@/mock-data/warehouseAgent";
import {
  isDocumentAnalysisAgent,
  isPricingAgent,
  isWarehouseAgent
} from "@/utils/agentLaunch";
import type { AgentAccess } from "@/types";

const MOCK_AGENT_IDS = new Set([
  mockWarehouseAgent.id,
  mockPricingAgent.id,
  mockDocumentAnalysisAgent.id
]);

export function isMockAgent(agent: Pick<AgentAccess, "id">): boolean {
  return MOCK_AGENT_IDS.has(agent.id);
}

export function withMockAvailableAgents(agents: AgentAccess[]): AgentAccess[] {
  const result = [...agents];

  if (!result.some(isWarehouseAgent)) {
    result.push(mockWarehouseAgent);
  }
  if (!result.some(isPricingAgent)) {
    result.push(mockPricingAgent);
  }
  if (!result.some(isDocumentAnalysisAgent)) {
    result.push(mockDocumentAnalysisAgent);
  }

  return result;
}
