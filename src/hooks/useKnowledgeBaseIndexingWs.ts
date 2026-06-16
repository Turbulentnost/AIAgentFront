import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { API_SERVER } from "@/api/config";
import type {
  KnowledgeBaseIndexJobStatus,
  KnowledgeBaseIndexingJob,
  KnowledgeBaseListItem,
  KnowledgeBaseStatus
} from "@/types";
import { isCancelledJobStatus } from "@/utils/knowledgeBaseIndexing";

export interface KnowledgeBaseIndexingWsJob {
  id: string;
  status: KnowledgeBaseIndexJobStatus;
  job_type?: KnowledgeBaseIndexingJob["job_type"];
  current_stage?: string | null;
  processing_params?: Record<string, unknown> | null;
  cancel_requested?: boolean;
  processed_sources_count?: number;
  total_sources_count?: number;
  created_fragments_count?: number;
  updated_fragments_count?: number;
  total_chunks_count?: number;
  extracted_sources_count?: number;
  chunked_sources_count?: number;
  embedded_chunks_count?: number;
  qdrant_points_count?: number;
  fulltext_chunks_count?: number;
  errors_count?: number;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface KnowledgeBaseIndexingWsMessage {
  event: string;
  knowledge_base_id: string;
  knowledge_base_status: KnowledgeBaseStatus;
  indexing_active: boolean;
  fragments_count: number;
  sources_count: number;
  job: KnowledgeBaseIndexingWsJob | null;
  sent_at?: string;
}

function buildIndexingWsUrl(knowledgeBaseId: string): string | null {
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  const path = `/api/v1/knowledge-bases/${knowledgeBaseId}/index/ws?token=${encodeURIComponent(token)}`;
  if (import.meta.env.DEV) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${path}`;
  }
  const wsBase = API_SERVER.replace(/^http/i, (match) => (match.toLowerCase() === "https" ? "wss" : "ws"));
  return `${wsBase}${path}`;
}

function mergeWsJob(
  jobs: KnowledgeBaseIndexingJob[] | undefined,
  wsJob: KnowledgeBaseIndexingWsJob,
  knowledgeBaseId: string
): KnowledgeBaseIndexingJob[] {
  const existing = jobs?.find((job) => job.id === wsJob.id);
  const currentStage = wsJob.current_stage ?? wsJob.processing_params?.current_stage;
  const processing_params = {
    ...(existing?.processing_params ?? {}),
    ...(wsJob.processing_params ?? {}),
    ...(typeof currentStage === "string" ? { current_stage: currentStage } : {})
  };
  const merged: KnowledgeBaseIndexingJob = {
    ...(existing ?? {
      id: wsJob.id,
      knowledge_base_id: knowledgeBaseId,
      job_type: wsJob.job_type ?? "full",
      target_source_id: null,
      duration_ms: null,
      started_by_user_id: null,
      embedding_model: null,
      vector_store: "qdrant",
      qdrant_collection: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }),
    status: wsJob.status,
    cancel_requested: wsJob.cancel_requested ?? existing?.cancel_requested ?? false,
    processed_sources_count: wsJob.processed_sources_count ?? existing?.processed_sources_count ?? 0,
    created_fragments_count: wsJob.created_fragments_count ?? existing?.created_fragments_count ?? 0,
    updated_fragments_count: wsJob.updated_fragments_count ?? existing?.updated_fragments_count ?? 0,
    errors_count: wsJob.errors_count ?? existing?.errors_count ?? 0,
    total_sources_count: wsJob.total_sources_count ?? existing?.total_sources_count,
    total_chunks_count: wsJob.total_chunks_count ?? existing?.total_chunks_count,
    extracted_sources_count: wsJob.extracted_sources_count ?? existing?.extracted_sources_count,
    chunked_sources_count: wsJob.chunked_sources_count ?? existing?.chunked_sources_count,
    embedded_chunks_count: wsJob.embedded_chunks_count ?? existing?.embedded_chunks_count,
    qdrant_points_count: wsJob.qdrant_points_count ?? existing?.qdrant_points_count,
    fulltext_chunks_count: wsJob.fulltext_chunks_count ?? existing?.fulltext_chunks_count,
    started_at: wsJob.started_at ?? existing?.started_at ?? null,
    finished_at: wsJob.finished_at ?? existing?.finished_at ?? null,
    processing_params
  };
  if (existing && jobs) {
    return jobs.map((job) => (job.id === wsJob.id ? merged : job));
  }
  return [merged, ...(jobs ?? [])];
}

function applyIndexingMessage(queryClient: QueryClient, message: KnowledgeBaseIndexingWsMessage) {
  const kbId = message.knowledge_base_id;
  const jobCancelled = message.job ? isCancelledJobStatus(message.job.status) : false;
  const indexingActive = jobCancelled ? false : message.indexing_active;

  if (message.job) {
    queryClient.setQueryData<KnowledgeBaseIndexingJob[]>(["knowledge-base-jobs", kbId], (jobs) =>
      mergeWsJob(jobs, message.job!, kbId)
    );
  }

  queryClient.setQueriesData<KnowledgeBaseListItem[]>({ queryKey: ["knowledge-bases"] }, (items) =>
    items?.map((item) =>
      item.id === kbId
        ? {
            ...item,
            status: message.knowledge_base_status,
            indexing_active: indexingActive,
            fragments_count: message.fragments_count,
            sources_count: message.sources_count
          }
        : item
    )
  );

  if (["completed", "failed", "cancelled", "partial"].includes(message.event) || jobCancelled) {
    void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    void queryClient.invalidateQueries({ queryKey: ["knowledge-base-jobs", kbId] });
    void queryClient.invalidateQueries({ queryKey: ["knowledge-base-sources", kbId] });
    void queryClient.invalidateQueries({ queryKey: ["knowledge-base-chunks", kbId] });
    void queryClient.invalidateQueries({ queryKey: ["knowledge-bases", "stats"] });
    void queryClient.invalidateQueries({ queryKey: ["knowledge-base-overview", kbId] });
  }
}

export function useKnowledgeBaseIndexingWs(knowledgeBaseId: string | null | undefined, enabled: boolean) {
  const queryClient = useQueryClient();
  const reconnectAttempt = useRef(0);

  useEffect(() => {
    if (!enabled || !knowledgeBaseId) return;

    const url = buildIndexingWsUrl(knowledgeBaseId);
    if (!url) return;

    let socket: WebSocket | null = null;
    let disposed = false;
    let reconnectTimer: number | undefined;
    let pingTimer: number | undefined;

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(url);

      socket.onopen = () => {
        reconnectAttempt.current = 0;
        pingTimer = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send("ping");
        }, 25000);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as KnowledgeBaseIndexingWsMessage;
          if (message.event === "pong") return;
          applyIndexingMessage(queryClient, message);
        } catch {
          // ignore malformed payloads
        }
      };

      socket.onclose = () => {
        if (pingTimer) window.clearInterval(pingTimer);
        if (disposed) return;
        const delay = Math.min(10000, 1000 * 2 ** reconnectAttempt.current);
        reconnectAttempt.current += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (pingTimer) window.clearInterval(pingTimer);
      socket?.close();
    };
  }, [enabled, knowledgeBaseId, queryClient]);
}
