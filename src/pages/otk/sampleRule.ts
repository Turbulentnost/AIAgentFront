/** Client-side sampling rules aligned with СТО-10-095 / Прил. В (MVP). */

import type { OtkShipmentLine, OtkTmcCategory } from "./mockData";

export type SampleBasis = "10pct" | "1pct_rating" | "per_package" | "category_default";

export type SampleRuleView = {
  ruleId: string;
  category: OtkTmcCategory;
  sampleSize: number | null;
  samplePct: number | null;
  sampleBasis: SampleBasis;
  sampleNote: string;
  scrapThresholdPct: number;
  lotQty: number;
};

const SCRAP_THRESHOLD_PCT = 15;

const TMC_CATEGORIES: readonly OtkTmcCategory[] = [
  "electronics",
  "metal",
  "fasteners",
  "cable",
  "pipes",
  "flanges",
  "gaskets",
  "drawing_parts",
  "other"
] as const;

/** Exact label/key → category (no substring matching — avoids «cable»/«metal» confusion). */
const CATEGORY_EXACT: Record<string, OtkTmcCategory> = {
  electronics: "electronics",
  электроника: "electronics",
  metal: "metal",
  металл: "metal",
  fasteners: "fasteners",
  крепеж: "fasteners",
  "крепёж": "fasteners",
  метизы: "fasteners",
  cable: "cable",
  кабель: "cable",
  pipes: "pipes",
  трубы: "pipes",
  flanges: "flanges",
  фланцы: "flanges",
  gaskets: "gaskets",
  прокладки: "gaskets",
  drawing_parts: "drawing_parts",
  "детали по чертежу": "drawing_parts",
  чертежные: "drawing_parts",
  other: "other",
  прочее: "other"
};

/**
 * Category → sampling mode (единый источник с `build_sample_rule` на бэке).
 * - fasteners → из каждой тары (без %)
 * - остальные → 10% партии; при макс. рейтинге поставщика → 1%
 */
type CategoryPolicy =
  | { mode: "per_package" }
  | { mode: "percent"; basePct: number; allowMaxRating1pct: boolean };

const CATEGORY_SAMPLE_POLICY: Record<OtkTmcCategory, CategoryPolicy> = {
  fasteners: { mode: "per_package" },
  electronics: { mode: "percent", basePct: 10, allowMaxRating1pct: true },
  metal: { mode: "percent", basePct: 10, allowMaxRating1pct: true },
  cable: { mode: "percent", basePct: 10, allowMaxRating1pct: true },
  pipes: { mode: "percent", basePct: 10, allowMaxRating1pct: true },
  flanges: { mode: "percent", basePct: 10, allowMaxRating1pct: true },
  gaskets: { mode: "percent", basePct: 10, allowMaxRating1pct: true },
  drawing_parts: { mode: "percent", basePct: 10, allowMaxRating1pct: true },
  other: { mode: "percent", basePct: 10, allowMaxRating1pct: true }
};

export function normalizeTmcCategory(raw: string | null | undefined): OtkTmcCategory {
  if (raw == null || raw === "") return "other";
  const key = String(raw).trim().toLowerCase().replaceAll("ё", "е");
  if (key in CATEGORY_EXACT) return CATEGORY_EXACT[key];
  if ((TMC_CATEGORIES as readonly string[]).includes(key)) {
    return key as OtkTmcCategory;
  }
  return "other";
}

function isMaxSupplierRating(rating: string | number | null | undefined): boolean {
  if (rating === null || rating === undefined || rating === "") return false;
  const asNumber = Number(rating);
  if (!Number.isNaN(asNumber)) return asNumber >= 40;
  const normalized = String(rating).toLowerCase();
  return normalized === "max" || normalized === "максимальный" || normalized === "maximum";
}

function lotQtyOf(line: OtkShipmentLine): number {
  return line.qtyFact > 0 ? line.qtyFact : line.qtyUpd;
}

export function buildSampleRuleForLine(line: OtkShipmentLine): SampleRuleView {
  const lotQty = lotQtyOf(line);
  const category = normalizeTmcCategory(line.category);
  const policy = CATEGORY_SAMPLE_POLICY[category];
  const unit = line.storageUnit || "шт";
  const noteParts = [`Правила выборки для группы «${category}» (Прил. В / СТО-10-095).`];
  noteParts.push(`Объём партии (факт): ${lotQty} ${unit}.`);

  let sampleSize: number | null = null;
  let samplePct: number | null = null;
  let sampleBasis: SampleBasis = "category_default";

  if (policy.mode === "per_package") {
    sampleBasis = "per_package";
    sampleSize = null;
    samplePct = null;
    noteParts.push("Крепёж (метизы): выборка из каждой тары / коробки.");
  } else if (lotQty > 0) {
    if (policy.allowMaxRating1pct && isMaxSupplierRating(line.supplierQualityRating)) {
      samplePct = 1;
      sampleBasis = "1pct_rating";
      sampleSize = Math.max(1, Math.round(lotQty * 0.01));
      noteParts.push(
        `Максимальный рейтинг поставщика — выборка 1% (${sampleSize} ${unit}).`
      );
    } else {
      samplePct = policy.basePct;
      sampleBasis = policy.basePct === 10 ? "10pct" : "category_default";
      sampleSize = Math.max(1, Math.round(lotQty * (policy.basePct / 100)));
      noteParts.push(`Базовая выборка ≈ ${samplePct}% партии (${sampleSize} ${unit}).`);
    }
  } else {
    noteParts.push("Объём партии не указан — числовая выборка недоступна.");
  }

  noteParts.push(
    `Порог брака ${SCRAP_THRESHOLD_PCT}%: при меньшем браке — вторая выборка и решение ЗДК.`
  );

  return {
    ruleId: `QC.SAMPLE.${category.toUpperCase()}`,
    category,
    sampleSize,
    samplePct,
    sampleBasis,
    sampleNote: noteParts.join(" "),
    scrapThresholdPct: SCRAP_THRESHOLD_PCT,
    lotQty
  };
}

/**
 * Prefer server sample_rule only when it still matches current category + lot;
 * otherwise recompute so category/qty edits always refresh the cell.
 */
export function resolveSampleForLine(
  line: OtkShipmentLine & { sampleRule?: SampleRuleView | null }
): SampleRuleView {
  const cached = line.sampleRule;
  const lotQty = lotQtyOf(line);
  const category = normalizeTmcCategory(line.category);
  if (
    cached &&
    normalizeTmcCategory(cached.category) === category &&
    Number(cached.lotQty) === Number(lotQty)
  ) {
    return { ...cached, category };
  }
  return buildSampleRuleForLine({ ...line, category });
}

export function sampleBasisLabel(basis: SampleBasis): string {
  switch (basis) {
    case "10pct":
      return "10% партии";
    case "1pct_rating":
      return "1% (макс. рейтинг)";
    case "per_package":
      return "из каждой тары";
    default:
      return "по категории";
  }
}

/** Compact cell text: `5 шт · 1%` (or short fasteners label). */
export function formatSampleCompact(
  sample: SampleRuleView,
  storageUnit = "шт"
): string {
  if (sample.sampleBasis === "per_package") {
    return "из каждой тары";
  }
  if (sample.sampleSize != null && sample.samplePct != null) {
    return `${sample.sampleSize} ${storageUnit} · ${sample.samplePct}%`;
  }
  if (sample.sampleSize != null) {
    return `${sample.sampleSize} ${storageUnit}`;
  }
  if (sample.samplePct != null) {
    return `${sample.samplePct}%`;
  }
  return "—";
}

/** Map API `sample_rule` (snake_case) into the client view model. */
export function sampleRuleFromApi(raw: {
  rule_id: string;
  category: string;
  sample_size?: number | null;
  sample_pct?: number | null;
  sample_basis?: SampleBasis | string | null;
  sample_note?: string;
  scrap_threshold_pct?: number;
  lot_qty?: number | null;
} | null | undefined): SampleRuleView | null {
  if (!raw) return null;
  const basis = (raw.sample_basis ?? "category_default") as SampleBasis;
  return {
    ruleId: raw.rule_id,
    category: normalizeTmcCategory(raw.category),
    sampleSize: raw.sample_size ?? null,
    samplePct: raw.sample_pct ?? null,
    sampleBasis: basis,
    sampleNote: raw.sample_note ?? "",
    scrapThresholdPct: raw.scrap_threshold_pct ?? SCRAP_THRESHOLD_PCT,
    lotQty: raw.lot_qty ?? 0
  };
}
