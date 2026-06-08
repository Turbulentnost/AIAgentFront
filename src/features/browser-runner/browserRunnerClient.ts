import { browserRunsApi } from "@/api/endpoints";
import type { BrowserRunResult } from "./types";

export const browserRunnerClient = {
  pending: browserRunsApi.pending,
  submitResult: (runId: string, payload: BrowserRunResult) => browserRunsApi.submitResult(runId, payload)
};
