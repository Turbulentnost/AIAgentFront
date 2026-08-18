import type { User } from "@/types";

export const AVION_ONLY_USER_EMAILS = new Set([
  "rodionov.pavel@local.dev",
  "ermolenko.sergey@local.dev",
  "tishchenko.nadezhda@local.dev",
  "aksinin.leonid@local.dev",
  "gaponova.ksenia@local.dev",
  "bugata.pavel@local.dev",
  "dogadin.alexandr@local.dev",
  "kuraev.alexey@local.dev",
  "golovinov.konstantin@local.dev",
  "agadzhanyan.samvel@local.dev"
]);

export const AVION_ONLY_USER_FULL_NAMES = new Set([
  "Родионов Павел",
  "Ермоленко Сергей Александрович",
  "Тищенко Надежда",
  "Аксинин Леонид",
  "Гапонова Ксения Светославовна",
  "Бугата Павел Викторович",
  "Догадин Александр Михайлович",
  "Кураев Алексей Витальевич",
  "Головинов Константин Эдуардович",
  "Агаджанян Самвел Гагикович"
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
