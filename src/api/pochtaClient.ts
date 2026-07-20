import axios from "axios";

/** Локальный REST API agent-pochta (scripts/run_api.py). В dev — через Vite proxy /pochta-api. */
export const POCHTA_API_BASE =
  import.meta.env.VITE_POCHTA_API_URL ||
  (import.meta.env.DEV ? "/pochta-api" : "http://localhost:8080");

export const pochtaApiClient = axios.create({
  baseURL: POCHTA_API_BASE,
  timeout: 60_000
});
