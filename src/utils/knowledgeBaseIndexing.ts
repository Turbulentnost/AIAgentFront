import type { KnowledgeBaseIndexJobStatus, KnowledgeBaseIndexingJob, KnowledgeBaseListItem } from "@/types";

export function normalizeJobStatus(status: KnowledgeBaseIndexJobStatus | string | undefined | null): string {
  return String(status ?? "").toLowerCase();
}

export function isCancelledJobStatus(status: KnowledgeBaseIndexJobStatus | string | undefined | null): boolean {
  return normalizeJobStatus(status) === "cancelled";
}

export function isActiveJobStatus(status: KnowledgeBaseIndexJobStatus | string | undefined | null): boolean {
  const normalized = normalizeJobStatus(status);
  return normalized === "queued" || normalized === "running";
}

export function isKnowledgeBaseIndexingActive(
  kb: Pick<KnowledgeBaseListItem, "indexing_active" | "status">,
  latestJob?: KnowledgeBaseIndexingJob | null
): boolean {
  if (latestJob && isCancelledJobStatus(latestJob.status)) {
    return false;
  }
  if (latestJob && isActiveJobStatus(latestJob.status)) {
    return true;
  }
  return Boolean(kb.indexing_active);
}
