import type { AgentAccess } from "@/types";
import { DOCUMENT_ANALYSIS_AGENT_SLUG } from "@/utils/agentLaunch";

export const MOCK_DOCUMENT_ANALYSIS_AGENT_ID = "mock-document-analysis-agent";

export const mockDocumentAnalysisAgent: AgentAccess = {
  id: MOCK_DOCUMENT_ANALYSIS_AGENT_ID,
  name: "Агент закупок (Авион)",
  slug: DOCUMENT_ANALYSIS_AGENT_SLUG,
  purpose:
    "Принимает файлы по закупкам, анализирует содержимое через LM Studio и формирует выводы для дальнейшей обработки.",
  status: "active",
  icon_url: null,
  department_id: null,
  owner_id: null,
  created_at: "2026-07-20T00:00:00.000Z",
  updated_at: "2026-07-20T00:00:00.000Z",
  access_level: null,
  can_run: true,
  can_view_results: true,
  can_approve: false,
  can_configure: false
};

export const documentAnalysisAgentSubtitle =
  "Загрузите Excel-файлы по закупкам. Агент отправит их на обработку в LM Studio и сформирует result.xlsx.";

export const documentAnalysisAcceptedExtensions = [
  ".xlsx",
  ".xlsm"
] as const;

export function isAcceptedAnalysisFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return documentAnalysisAcceptedExtensions.some((ext) => lowerName.endsWith(ext));
}
