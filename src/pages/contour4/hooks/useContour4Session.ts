import { useMemo, useState } from "react";
import { isContour4AgentId } from "@/mock-data/contour4";
import type { Contour4SessionRole } from "@/types/contour4";
import {
  getContour4Session,
  setContour4Session
} from "../contour4Session";

export function useContour4Session(agentId: string) {
  const [sessionTick, setSessionTick] = useState(0);

  const session = useMemo(
    () => getContour4Session(isContour4AgentId(agentId) ? agentId : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionTick forces re-read
    [agentId, sessionTick]
  );

  const updateSession = (next: Contour4SessionRole) => {
    setContour4Session(next);
    setSessionTick((t) => t + 1);
  };

  return { session, updateSession };
}
