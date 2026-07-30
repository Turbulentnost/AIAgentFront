/** Merge server presentation cards without clobbering newer local line edits. */

import type { OtkPresentationCardUi, OtkShipmentLineUi } from "./otkMappers";

/**
 * Apply a server mutation card onto local state.
 * - Line membership/ids follow the server (add/delete).
 * - For ids present locally, keep the local row (UI is SoT while the card is open).
 * - Local-only rows are kept only while locked (in-edit temp lines).
 * - Header: server fields, unless `keepHeader`.
 */
export function mergePresentationCard(
  local: OtkPresentationCardUi | null,
  server: OtkPresentationCardUi,
  lockedLineIds: ReadonlySet<string>,
  keepHeader = false
): OtkPresentationCardUi {
  if (!local || local.id !== server.id) return server;

  const localById = new Map(local.lines.map((line) => [line.id, line]));
  const serverIds = new Set(server.lines.map((line) => line.id));

  const lines: OtkShipmentLineUi[] = server.lines.map((serverLine) => {
    const localLine = localById.get(serverLine.id);
    return localLine ?? serverLine;
  });

  for (const localLine of local.lines) {
    if (!serverIds.has(localLine.id) && lockedLineIds.has(localLine.id)) {
      lines.push(localLine);
    }
  }

  if (keepHeader) {
    return { ...local, lines };
  }
  return { ...server, lines };
}

/**
 * React Query cache merge for a line PATCH response: the patched line is taken
 * from `incoming`; other lines prefer `previous` so a stale in-flight response
 * cannot roll back a newer category/sample already in the cache.
 * Line membership follows `incoming` (server snapshot).
 */
export function mergeDetailCacheAfterLinePatch(
  previous: OtkPresentationCardUi | undefined,
  incoming: OtkPresentationCardUi,
  patchedLineId: string
): OtkPresentationCardUi {
  if (!previous || previous.id !== incoming.id) return incoming;

  const previousById = new Map(previous.lines.map((line) => [line.id, line]));
  const lines: OtkShipmentLineUi[] = incoming.lines.map((serverLine) => {
    if (serverLine.id === patchedLineId) return serverLine;
    return previousById.get(serverLine.id) ?? serverLine;
  });

  return { ...incoming, lines };
}

/**
 * Header / add / delete responses carry a full lines snapshot that may predate
 * a newer line PATCH already in cache. Keep cached rows for shared ids; take
 * membership (adds/deletes) from `incoming`.
 */
export function mergeCardPreferCachedLines(
  previous: OtkPresentationCardUi | undefined,
  incoming: OtkPresentationCardUi
): OtkPresentationCardUi {
  if (!previous || previous.id !== incoming.id) return incoming;
  const previousById = new Map(previous.lines.map((line) => [line.id, line]));
  const lines: OtkShipmentLineUi[] = incoming.lines.map(
    (serverLine) => previousById.get(serverLine.id) ?? serverLine
  );
  return { ...incoming, lines };
}
