export interface ExportColumn {
  key: string;
  title: string;
}

function escapeCsvCell(value: unknown, separator: string): string {
  const text = String(value ?? "");
  if (text.includes(separator) || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function exportTableToExcel(
  filename: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[]
) {
  const separator = ";";
  const header = columns.map((column) => escapeCsvCell(column.title, separator)).join(separator);
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvCell(row[column.key], separator)).join(separator)
  );
  const content = `\ufeff${[header, ...body].join("\r\n")}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
