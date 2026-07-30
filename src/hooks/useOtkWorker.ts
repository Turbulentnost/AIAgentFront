import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { otkApi } from "@/api/endpoints";
import {
  mergeCardPreferCachedLines,
  mergeDetailCacheAfterLinePatch
} from "@/pages/otk/otkCardMerge";
import {
  mapPresentation,
  mapWorker,
  toLineCreate,
  toLineUpdate,
  toPresentationUpdate,
  type OtkPresentationCardUi,
  type OtkShipmentLineUi
} from "@/pages/otk/otkMappers";

export const otkKeys = {
  all: ["otk"] as const,
  list: () => [...otkKeys.all, "list"] as const,
  detail: (id: string) => [...otkKeys.all, "detail", id] as const
};

export function useOtkPresentationsList() {
  return useQuery({
    queryKey: otkKeys.list(),
    queryFn: async () => {
      const data = await otkApi.listPresentations();
      return {
        items: data.items,
        pendingCount: data.pending_count,
        earliestDueAt: data.earliest_due_at,
        workers: data.workers.map(mapWorker)
      };
    }
  });
}

export function useOtkPresentation(presentationId: string | null) {
  return useQuery({
    queryKey: otkKeys.detail(presentationId ?? ""),
    queryFn: async () => mapPresentation(await otkApi.getPresentation(presentationId!)),
    enabled: Boolean(presentationId),
    // Local card is authoritative while editing; a focus-refetch that started
    // before a category PATCH can otherwise snap sample % back after save.
    refetchOnWindowFocus: false
  });
}

export function useOtkUpdatePresentation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      presentationId,
      patch
    }: {
      presentationId: string;
      patch: Partial<OtkPresentationCardUi>;
    }) => mapPresentation(await otkApi.updatePresentation(presentationId, toPresentationUpdate(patch))),
    onSuccess: (card) => {
      queryClient.setQueryData(
        otkKeys.detail(card.id),
        (prev: OtkPresentationCardUi | undefined) =>
          mergeCardPreferCachedLines(prev, card)
      );
      void queryClient.invalidateQueries({ queryKey: otkKeys.list() });
    }
  });
}

export function useOtkAddLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      presentationId,
      line
    }: {
      presentationId: string;
      line: Partial<OtkShipmentLineUi>;
    }) => mapPresentation(await otkApi.addLine(presentationId, toLineCreate(line))),
    onSuccess: (card) => {
      queryClient.setQueryData(
        otkKeys.detail(card.id),
        (prev: OtkPresentationCardUi | undefined) =>
          mergeCardPreferCachedLines(prev, card)
      );
      void queryClient.invalidateQueries({ queryKey: otkKeys.list() });
    }
  });
}

export function useOtkUpdateLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      presentationId,
      lineId,
      patch
    }: {
      presentationId: string;
      lineId: string;
      patch: Partial<OtkShipmentLineUi>;
    }) =>
      mapPresentation(await otkApi.updateLine(presentationId, lineId, toLineUpdate(patch))),
    onSuccess: () => {
      // Detail cache is updated by the caller only when the per-line epoch still
      // matches — otherwise a slower older PATCH would revive the previous category.
      void queryClient.invalidateQueries({ queryKey: otkKeys.list() });
    }
  });
}

/** Apply a line-PATCH card into the detail cache (epoch-checked by caller). */
export function writeOtkDetailCache(
  queryClient: ReturnType<typeof useQueryClient>,
  card: OtkPresentationCardUi,
  patchedLineId: string
) {
  queryClient.setQueryData(
    otkKeys.detail(card.id),
    (prev: OtkPresentationCardUi | undefined) =>
      mergeDetailCacheAfterLinePatch(prev, card, patchedLineId)
  );
}

export function useOtkDeleteLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      presentationId,
      lineId
    }: {
      presentationId: string;
      lineId: string;
    }) => mapPresentation(await otkApi.deleteLine(presentationId, lineId)),
    onSuccess: (card) => {
      queryClient.setQueryData(
        otkKeys.detail(card.id),
        (prev: OtkPresentationCardUi | undefined) =>
          mergeCardPreferCachedLines(prev, card)
      );
      void queryClient.invalidateQueries({ queryKey: otkKeys.list() });
    }
  });
}

export function useOtkWriteTo1C() {
  return useMutation({
    mutationFn: (presentationId: string) => otkApi.writeTo1C(presentationId)
  });
}
