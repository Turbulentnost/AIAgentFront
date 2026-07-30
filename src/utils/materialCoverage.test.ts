import { describe, expect, it } from "vitest";
import {
  coverageDocumentNumbers,
  effectiveActualizedAt,
  materialCoverageLabel
} from "./materialCoverage";

describe("material coverage UI", () => {
  it("labels supplier, transfer and mixed coverage", () => {
    expect(materialCoverageLabel(["supplier_order"])).toBe("Ведется закупка");
    expect(materialCoverageLabel(["transfer_order"])).toBe("Ведется перемещение");
    expect(materialCoverageLabel(["supplier_order", "transfer_order"])).toBe(
      "Закупка / перемещение"
    );
    expect(materialCoverageLabel(["mixed"])).toBe("Закупка / перемещение");
  });

  it("uses successful cycle time before generic case update time", () => {
    expect(
      effectiveActualizedAt({
        last_actualized_at: "2026-07-30T09:00:00+03:00",
        coverage_checked_at: "2026-07-30T08:59:00+03:00",
        updated_at: "2026-07-30T08:58:00+03:00"
      })
    ).toBe("2026-07-30T09:00:00+03:00");
    expect(
      effectiveActualizedAt({
        coverage_checked_at: "2026-07-30T08:59:00+03:00",
        updated_at: "2026-07-30T08:58:00+03:00"
      })
    ).toBe("2026-07-30T08:59:00+03:00");
  });

  it("renders supplier and transfer document numbers together", () => {
    expect(coverageDocumentNumbers(["ЗП-12"], ["ПР-7", "ПР-8"])).toBe(
      "ЗП-12 / ПР-7 / ПР-8"
    );
    expect(coverageDocumentNumbers([], [])).toBe("—");
  });
});
