import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { otkApi } from "@/api/endpoints";
import {
  mapPresentation,
  mapWorker,
  toLineCreate,
  toLineUpdate,
  toPresentationUpdate,
  type OtkPresentationCardUi,
  type OtkShipmentLineUi
} from "@/pages/otk/otkMappers";

const otkKeys = {
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
    enabled: Boolean(presentationId)
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
      queryClient.setQueryData(otkKeys.detail(card.id), card);
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
      queryClient.setQueryData(otkKeys.detail(card.id), card);
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
    onSuccess: (card) => {
      queryClient.setQueryData(otkKeys.detail(card.id), card);
      void queryClient.invalidateQueries({ queryKey: otkKeys.list() });
    }
  });
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
      queryClient.setQueryData(otkKeys.detail(card.id), card);
      void queryClient.invalidateQueries({ queryKey: otkKeys.list() });
    }
  });
}

export function useOtkWriteTo1C() {
  return useMutation({
    mutationFn: (presentationId: string) => otkApi.writeTo1C(presentationId)
  });
}
