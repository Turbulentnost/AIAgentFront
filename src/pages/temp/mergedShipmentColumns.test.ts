import {
  classifyShipmentCountry,
  resolveCountryColumnIndex,
  rowMatchesCountryFilter,
} from "@/pages/temp/mergedShipmentColumns";

describe("mergedShipmentColumns country filter", () => {
  it("finds country column by header", () => {
    expect(resolveCountryColumnIndex(["Номенклатура", "Изделие", "Страна", "2026-08-01"])).toBe(2);
  });

  it("classifies russia and china", () => {
    expect(classifyShipmentCountry("Россия")).toBe("russia");
    expect(classifyShipmentCountry("Китай")).toBe("china");
    expect(classifyShipmentCountry("")).toBe("unknown");
  });

  it("filters rows by country", () => {
    const row = ["Деталь", "Изделие", "Китай", "10"];
    expect(rowMatchesCountryFilter(row, 2, "china")).toBe(true);
    expect(rowMatchesCountryFilter(row, 2, "russia")).toBe(false);
    expect(rowMatchesCountryFilter(row, 2, "all")).toBe(true);
  });
});
