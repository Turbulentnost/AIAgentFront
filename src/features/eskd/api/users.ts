import { api } from "@/features/eskd/api/eskd";

export interface EskdUser {
  id: string;
  login: string;
  display_name: string;
  role: string;
  department?: string | null;
}

export async function fetchOtkUsers(): Promise<{ items: EskdUser[] }> {
  const { data } = await api.get<{ items: EskdUser[] }>("/api/v1/eskd/users", {
    params: { role: "ESKD_OTK" }
  });
  return data;
}
