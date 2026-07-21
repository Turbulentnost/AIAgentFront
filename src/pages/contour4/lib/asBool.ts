/** Normalize mock/API bool-as-string fields (true / "true" / 1). */
export function asBool(
  value: string | number | boolean | null | undefined
): boolean {
  return value === true || value === "true" || value === 1;
}
