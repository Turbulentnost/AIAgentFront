import axios from "axios";

/** true, если запрос отменён через AbortController / CancelToken. */
export function isRequestAborted(error: unknown, signal?: AbortSignal | null): boolean {
  if (signal?.aborted) return true;
  if (axios.isCancel(error)) return true;
  return axios.isAxiosError(error) && error.code === "ERR_CANCELED";
}
