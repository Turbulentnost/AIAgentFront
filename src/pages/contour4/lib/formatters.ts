export function formatCell(
  value: string | number | boolean | null | undefined
): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "да" : "нет";
  return String(value);
}

export function formatMoney(value: string | number): string {
  const n =
    typeof value === "number" ? value : Number(String(value).replace(/\s/g, ""));
  if (Number.isFinite(n)) {
    return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
  }
  return String(value);
}
