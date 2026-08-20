export type MaterialCalculatorLine = {
  nomenclature_key: string;
  code: string;
  name: string;
  unit: string;
  total_qty: number;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatQty(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  return String(value);
}

/** Локальная выгрузка, если backend ещё без endpoint export (Excel XML). */
export function exportMaterialLinesToExcelClient(lines: MaterialCalculatorLine[]): void {
  const header = ["Код", "Номенклатура", "Количество", "Ед. изм."];
  const rows = lines.map((line) => [
    line.code || "",
    line.name,
    formatQty(line.total_qty),
    line.unit || "—"
  ]);

  const tableRows = [header, ...rows]
    .map(
      (cells) =>
        `<Row>${cells
          .map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`)
          .join("")}</Row>`
    )
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Потребность">
<Table>
${tableRows}
</Table>
</Worksheet>
</Workbook>`;

  const blob = new Blob([`\ufeff${xml}`], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "potrebnost_materialov.xls";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportMaterialLinesToExcel(
  exportApi: (lines: MaterialCalculatorLine[]) => Promise<Blob>,
  lines: MaterialCalculatorLine[]
): Promise<void> {
  try {
    const blob = await exportApi(lines);
    downloadBlob(blob, "potrebnost_materialov.xlsx");
  } catch (error) {
    console.warn("[material-calculator] API export failed, using client fallback", error);
    exportMaterialLinesToExcelClient(lines);
  }
}
