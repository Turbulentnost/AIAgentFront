/** Client-side sampling rules aligned with СТО-10-095 v05 Прил. Б / п. 6.6–6.7. */

import type { OtkShipmentLine, OtkTmcCategory } from "./mockData";

export type SampleBasis =
  | "3pct"
  | "5pct"
  | "10pct"
  | "15pct"
  | "20pct"
  | "30pct"
  | "50pct"
  | "100pct"
  | "1pct_rating"
  | "per_package"
  | "category_default";

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
 * Category → sampling (единый источник с `build_sample_rule` на бэке).
 * СТО-10-095 v05 Прил. Б (ступени партии 0–50 / 51–100 / >100 шт.):
 * - electronics → 100 / 50 / 10 %
 * - drawing_parts → 100 / 50 / 10 %
 * - gaskets (РТИ) → 30 / 20 / 10 %
 * - fasteners (метизы) → 10 / 5 / 3 % + из каждой коробки (п. 6.6.3)
 * - metal/pipes/flanges → 100 %; рейтинг 1% не для труб/фланцев (п. 6.7.4)
 * - cable → 100 % (п. 6.7.2; отдельной строки Прил. Б нет)
 * - other → 10 % (Прил. Б п.12 СИЗ / умолчание)
 */
type CategoryPolicy = {
  tiers?: readonly [number, number, number];
  flatPct?: number;
  allowMaxRating1pct: boolean;
  sampleFromEachPackage?: boolean;
  stoRef: string;
};

const CATEGORY_SAMPLE_POLICY: Record<OtkTmcCategory, CategoryPolicy> = {
  electronics: {
    tiers: [100, 50, 10],
    allowMaxRating1pct: true,
    stoRef: "Прил. Б п.1 Радиоэлементы"
  },
  drawing_parts: {
    tiers: [100, 50, 10],
    allowMaxRating1pct: true,
    stoRef: "Прил. Б п.3 Детали литьём/мехобработкой"
  },
  gaskets: {
    tiers: [30, 20, 10],
    allowMaxRating1pct: true,
    stoRef: "Прил. Б п.4 РТИ"
  },
  metal: {
    flatPct: 100,
    allowMaxRating1pct: true,
    stoRef: "Прил. Б п.5 Металлопрокат"
  },
  pipes: {
    flatPct: 100,
    allowMaxRating1pct: false,
    stoRef: "Прил. Б п.5 Трубы; п. 6.7.4 исключение рейтинга"
  },
  flanges: {
    flatPct: 100,
    allowMaxRating1pct: false,
    stoRef: "Прил. Б п.5 Фланцы; п. 6.7.4 исключение рейтинга"
  },
  fasteners: {
    tiers: [10, 5, 3],
    allowMaxRating1pct: true,
    sampleFromEachPackage: true,
    stoRef: "Прил. Б п.7 Метизы; п. 6.6.3"
  },
  cable: {
    flatPct: 100,
    allowMaxRating1pct: true,
    stoRef: "п. 6.7.2 (кабель; % в Прил. Б не задан → 100% целостность)"
  },
  other: {
    flatPct: 10,
    allowMaxRating1pct: true,
    stoRef: "Прил. Б п.12 СИЗ / прочее по умолчанию 10%"
  }
};

function lotTier(qty: number): 0 | 1 | 2 {
  if (qty <= 50) return 0;
  if (qty <= 100) return 1;
  return 2;
}

function basePctForPolicy(policy: CategoryPolicy, qty: number): number {
  if (policy.flatPct != null) return policy.flatPct;
  if (policy.tiers) return policy.tiers[lotTier(qty)];
  return 10;
}

function sampleBasisForPct(pct: number): SampleBasis {
  switch (pct) {
    case 3:
      return "3pct";
    case 5:
      return "5pct";
    case 10:
      return "10pct";
    case 15:
      return "15pct";
    case 20:
      return "20pct";
    case 30:
      return "30pct";
    case 50:
      return "50pct";
    case 100:
      return "100pct";
    default:
      return "category_default";
  }
}

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
  const noteParts = [
    `Правила выборки для группы «${category}» (${policy.stoRef} / СТО-10-095 v05).`
  ];
  noteParts.push(`Объём партии (факт): ${lotQty} ${unit}.`);

  let sampleSize: number | null = null;
  let samplePct: number | null = null;
  let sampleBasis: SampleBasis = "category_default";

  if (lotQty > 0) {
    if (policy.allowMaxRating1pct && isMaxSupplierRating(line.supplierQualityRating)) {
      samplePct = 1;
      sampleBasis = "1pct_rating";
      sampleSize = Math.max(1, Math.round(lotQty * 0.01));
      noteParts.push(
        `Максимальный рейтинг поставщика — выборка 1% (${sampleSize} ${unit}).`
      );
    } else {
      samplePct = basePctForPolicy(policy, lotQty);
      sampleBasis = sampleBasisForPct(samplePct);
      sampleSize =
        samplePct >= 100
          ? Math.max(1, Math.round(lotQty))
          : Math.max(1, Math.round(lotQty * (samplePct / 100)));
      if (policy.tiers) {
        noteParts.push(
          `Выборка по Прил. Б (партия → ступень 0–50/51–100/>100): ${samplePct}% (${sampleSize} ${unit}).`
        );
      } else {
        noteParts.push(`Базовая выборка ${samplePct}% партии (${sampleSize} ${unit}).`);
      }
    }
  } else {
    noteParts.push("Объём партии не указан — числовая выборка недоступна.");
  }

  if (policy.sampleFromEachPackage) {
    noteParts.push(
      "Метизы: при нескольких коробках выборку проводить из каждой коробки (п. 6.6.3)."
    );
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
    case "3pct":
      return "3% партии";
    case "5pct":
      return "5% партии";
    case "10pct":
      return "10% партии";
    case "15pct":
      return "15% партии";
    case "20pct":
      return "20% партии";
    case "30pct":
      return "30% партии";
    case "50pct":
      return "50% партии";
    case "100pct":
      return "100% партии";
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
  if (sample.sampleBasis === "per_package" && sample.sampleSize == null) {
    return "из каждой тары";
  }
  if (sample.sampleSize != null && sample.samplePct != null) {
    const base = `${sample.sampleSize} ${storageUnit} · ${sample.samplePct}%`;
    if (sample.category === "fasteners") {
      return `${base} · из каждой тары`;
    }
    return base;
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
