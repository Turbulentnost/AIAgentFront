import type {
  Contour4AgentMock,
  Contour4HitlDecisionPayload,
  Contour4SessionRole
} from "@/types/contour4";

export function buildHitlPayload(
  agent: Contour4AgentMock,
  session: Contour4SessionRole,
  action: string,
  idempotencyKey: string
): Contour4HitlDecisionPayload {
  return {
    agent_id: agent.id,
    human_action: action,
    human_payload: {
      comment: undefined,
      ...(action === "set_priority"
        ? {
            line_priorities: [
              { payment_request_id: "PR-9", priority: 1 },
              { payment_request_id: "PR-1", priority: 2 }
            ]
          }
        : {})
    },
    idempotency_key: idempotencyKey,
    hitl_assignee_role: agent.hitl.hitl_assignee_role ?? agent.hitl.assignee_role,
    user_role: String(session.user_role)
  };
}

/** Mock transport — same payload shape as backend resume. */
export async function submitHitlDecision(
  payload: Contour4HitlDecisionPayload,
  signal?: AbortSignal
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, 400);
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
  console.info("[contour4 HITL mock submit]", payload);
}
