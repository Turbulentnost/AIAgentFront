import {
  buildMergedChinaHongKongSheet,
  canMergeChinaHongKongSheets,
  MERGED_CHINA_HONG_KONG_SHEET_TITLE,
  type ChinaHongKongSheetSource,
} from "@/pages/temp/mergeChinaHongKongSheets";

const itcHeader = ["№", "Позиция", "Модель", "Кол-во по спец-ии", "Дата отгрузки", "Дата оплаты"];

function sheet(title: string, values: string[][]): ChinaHongKongSheetSource {
  return {
    title,
    gid: title,
    rowCount: values.length,
    columnCount: Math.max(...values.map((row) => row.length), 0),
    values,
  };
}

describe("mergeChinaHongKongSheets", () => {
  it("merges china and hong kong with one shared header and section markers", () => {
    const china = sheet("КИТАЙ", [
      itcHeader,
      ["1", "Камера A", "Model-A", "10", "отправлен", "28.08"],
    ]);
    const hk = sheet("Гонконг В РАБОТЕ", [
      itcHeader,
      ["1", "Камера B", "Model-B", "20", "15.08-5 000", "28.08 - 3000"],
    ]);

    const merged = buildMergedChinaHongKongSheet(china, hk);
    expect(merged.title).toBe(MERGED_CHINA_HONG_KONG_SHEET_TITLE);
    expect(merged.values[0]).toEqual(itcHeader);
    expect(merged.values[1][0]).toBe("— КИТАЙ —");
    expect(merged.values[2][1]).toBe("Камера A");
    expect(merged.values[3][0]).toBe("— Гонконг В РАБОТЕ —");
    expect(merged.values[4][1]).toBe("Камера B");
  });

  it("detects when both source sheets are available", () => {
    expect(
      canMergeChinaHongKongSheets([
        sheet("ТАМОЖНЯ", [["x"]]),
        sheet("КИТАЙ", [itcHeader]),
        sheet("Гонконг В РАБОТЕ", [itcHeader]),
      ])
    ).toBe(true);
    expect(canMergeChinaHongKongSheets([sheet("КИТАЙ", [itcHeader])])).toBe(false);
  });
});
