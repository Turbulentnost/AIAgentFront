/**
 * Focused regression: stale refetch/PATCH must not revert a newer category sample.
 * Run: npx --yes tsx --test src/pages/otk/otkCardMerge.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeCardPreferCachedLines,
  mergeDetailCacheAfterLinePatch,
  mergePresentationCard
} from "./otkCardMerge";
import type { OtkPresentationCardUi, OtkShipmentLineUi } from "./otkMappers";
import { buildSampleRuleForLine } from "./sampleRule";

function line(
  partial: Partial<OtkShipmentLineUi> & Pick<OtkShipmentLineUi, "id" | "category">
): OtkShipmentLineUi {
  const base: OtkShipmentLineUi = {
    id: partial.id,
    code: partial.code ?? "C",
    nomenclature: partial.nomenclature ?? "N",
    storageUnit: partial.storageUnit ?? "шт",
    // qty 50 → electronics 100% по Прил. Б (ступень 0–50)
    qtyUpd: partial.qtyUpd ?? 50,
    qtyFact: partial.qtyFact ?? 50,
    category: partial.category,
    supplierQualityRating: partial.supplierQualityRating ?? null,
    accepted: partial.accepted ?? false,
    sampleRule: null
  };
  return {
    ...base,
    ...partial,
    sampleRule: partial.sampleRule ?? buildSampleRuleForLine(base)
  };
}

function card(lines: OtkShipmentLineUi[]): OtkPresentationCardUi {
  return {
    id: "pres-1",
    organization: "Org",
    purchaseOrder: "PO",
    projectCode: null,
    projectName: null,
    supplier: "S",
    counterparty: "C",
    warehouse: "W",
    invoiceDate: "2026-01-01",
    invoiceNumber: "УПД-1",
    storageZone: "Z",
    presentationPlace: "P",
    otkIncomingWarehouse: "O",
    executorId: "w1",
    dueAt: "2026-01-02",
    status: "in_progress",
    lines
  };
}

describe("mergePresentationCard", () => {
  it("keeps local category/sample for locked line when stale server card arrives", () => {
    const localLine = line({ id: "l1", category: "electronics" });
    const staleServerLine = line({ id: "l1", category: "metal" });
    const local = card([localLine]);
    const server = card([staleServerLine]);

    const merged = mergePresentationCard(local, server, new Set(["l1"]));
    const out = merged.lines[0];

    assert.equal(out.category, "electronics");
    assert.equal(out.sampleRule?.samplePct, 100);
    assert.equal(buildSampleRuleForLine(out).samplePct, 100);
  });

  it("applies server line when not locked (after save settles)", () => {
    const localLine = line({ id: "l1", category: "electronics" });
    const serverLine = line({ id: "l1", category: "electronics" });
    const merged = mergePresentationCard(card([localLine]), card([serverLine]), new Set());
    assert.equal(merged.lines[0].category, "electronics");
    assert.equal(merged.lines[0].sampleRule?.samplePct, 100);
  });

  it("uses server membership on add while preserving local category on other rows", () => {
    const local = card([
      line({ id: "A", category: "electronics" }),
      line({ id: "temp-1", category: "other", nomenclature: "draft" })
    ]);
    const server = card([
      line({ id: "A", category: "metal" }),
      line({ id: "B-new", category: "other", nomenclature: "draft" })
    ]);
    // temp-1 not locked → dropped after server ack; A keeps local category.
    const merged = mergePresentationCard(local, server, new Set());
    assert.equal(merged.lines.find((l) => l.id === "A")?.category, "electronics");
    assert.ok(merged.lines.some((l) => l.id === "B-new"));
    assert.equal(merged.lines.some((l) => l.id === "temp-1"), false);
  });
});

describe("mergeDetailCacheAfterLinePatch", () => {
  it("does not let a stale patch for line B roll back newer category on line A", () => {
    const cache = card([
      line({ id: "A", category: "electronics" }),
      line({ id: "B", category: "metal", nomenclature: "old" })
    ]);
    // Stale response started before A's category change; still has metal on A.
    const staleIncoming = card([
      line({ id: "A", category: "metal" }),
      line({ id: "B", category: "metal", nomenclature: "new-B" })
    ]);

    const merged = mergeDetailCacheAfterLinePatch(cache, staleIncoming, "B");
    const a = merged.lines.find((l) => l.id === "A");
    const b = merged.lines.find((l) => l.id === "B");

    assert.equal(a?.category, "electronics");
    assert.equal(a?.sampleRule?.samplePct, 100);
    assert.equal(b?.nomenclature, "new-B");
  });
});

describe("mergeCardPreferCachedLines", () => {
  it("keeps newer cached category when a stale header/refetch snapshot arrives", () => {
    const cache = card([line({ id: "l1", category: "electronics" })]);
    const stale = card([line({ id: "l1", category: "metal" })]);
    const merged = mergeCardPreferCachedLines(cache, stale);
    assert.equal(merged.lines[0].category, "electronics");
    assert.equal(buildSampleRuleForLine(merged.lines[0]).samplePct, 100);
  });
});
