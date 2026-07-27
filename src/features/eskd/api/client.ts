const DEV_USER_KEY = "eskd_dev_user";
const DEV_ROLES_KEY = "eskd_dev_roles";

const baseURL = import.meta.env.VITE_ESKD_API_URL ?? "/eskd-api";

export function getDevUser(): string {
  return localStorage.getItem(DEV_USER_KEY) || "arsunov.test";
}

export function getDevRoles(): string {
  return localStorage.getItem(DEV_ROLES_KEY) || "ESKD_OTK";
}

export function setDevAuth(user: string, roles: string): void {
  localStorage.setItem(DEV_USER_KEY, user);
  localStorage.setItem(DEV_ROLES_KEY, roles);
}

export function syncEskdAuthFromPlatformUser(user: {
  username?: string | null;
  email?: string | null;
  full_name?: string | null;
}) {
  const email = (user.email ?? "").toLowerCase();
  const username = (user.username ?? "").toLowerCase();
  const login =
    email.startsWith("arsunov") || username === "arsunov.test"
      ? "otk.arsunov"
      : user.username?.trim() ||
        user.email?.split("@")[0]?.trim() ||
        user.full_name?.trim().toLowerCase().replace(/\s+/g, ".") ||
        "platform-user";
  setDevAuth(login, "ESKD_OTK,ESKD_Designers");
}

function eskdHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Dev-User": getDevUser(),
    "X-Dev-Roles": getDevRoles()
  };
  const platformToken = localStorage.getItem("access_token");
  if (platformToken) headers.Authorization = `Bearer ${platformToken}`;
  return headers;
}

export async function apiGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${baseURL}${path}`, { headers: eskdHeaders() });
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
  return resp.json() as Promise<T>;
}
