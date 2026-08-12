import type { User } from "@/types";

export const AVION_ONLY_USER_EMAILS = new Set([
  "rodionov.pavel@local.dev",
  "tishchenko.nadezhda@local.dev",
  "aksinin.leonid@local.dev",
]);

export const AVION_ONLY_USER_FULL_NAMES = new Set([
  "Родионов Павел",
  "Тищенко Надежда",
  "Аксинин Леонид",
]);

export function isAvionOnlyUser(
  user: Pick<User, "email" | "full_name" | "is_superuser"> | null | undefined
): boolean {
  if (!user || user.is_superuser) return false;

  const email = user.email?.trim().toLowerCase();
  if (email && AVION_ONLY_USER_EMAILS.has(email)) return true;

  const fullName = user.full_name?.trim();
  return Boolean(fullName && AVION_ONLY_USER_FULL_NAMES.has(fullName));
}
