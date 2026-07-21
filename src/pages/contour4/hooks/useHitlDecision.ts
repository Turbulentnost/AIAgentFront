import { useEffect, useRef, useState } from "react";
import type { Contour4AgentMock, Contour4SessionRole } from "@/types/contour4";
import {
  buildHitlPayload,
  submitHitlDecision
} from "../lib/hitlTransport";

export function useHitlDecision({
  agentId,
  agent,
  session
}: {
  agentId: string;
  agent: Contour4AgentMock | null;
  session: Contour4SessionRole;
}) {
  const [doneAction, setDoneAction] = useState<string | null>(null);
  const [lastIdempotencyKey, setLastIdempotencyKey] = useState<string | null>(
    null
  );
  const workspaceAliveRef = useRef(true);

  useEffect(() => {
    workspaceAliveRef.current = true;
    return () => {
      workspaceAliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    setDoneAction(null);
    setLastIdempotencyKey(null);
  }, [agentId]);

  const onDecide = async (
    action: string,
    idempotencyKey: string,
    signal?: AbortSignal
  ) => {
    if (!agent) return;
    const payload = buildHitlPayload(agent, session, action, idempotencyKey);
    await submitHitlDecision(payload, signal);
    if (!workspaceAliveRef.current || signal?.aborted) {
      return;
    }
    setLastIdempotencyKey(idempotencyKey);
    setDoneAction(action);
  };

  return { doneAction, lastIdempotencyKey, onDecide };
}
