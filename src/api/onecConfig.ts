const DEFAULT_ONEC_API_SERVER = "http://192.168.0.247:8000";

/** Базовый URL API задач 1С (без /api/v1). */
export const ONEC_API_SERVER =
  import.meta.env.VITE_ONEC_API_SERVER || DEFAULT_ONEC_API_SERVER;

/**
 * В dev запросы идут через Vite proxy `/onec-api`, чтобы не попадать
 * в `/api` платформы и не упираться в CORS.
 */
export const ONEC_API_BASE_URL =
  import.meta.env.VITE_ONEC_API_URL ||
  (import.meta.env.DEV ? "/onec-api/api/v1" : `${ONEC_API_SERVER}/api/v1`);
