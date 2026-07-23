/** Map OTK API (snake_case) ↔ UI models (camelCase). */

import type {
  OtkPresentationCard,
  OtkShipmentLine,
  OtkWorker
} from "@/pages/otk/mockData";
import {
  normalizeTmcCategory,
  sampleRuleFromApi,
  type SampleRuleView
} from "@/pages/otk/sampleRule";
import type {
  OtkPresentationCardApi,
  OtkPresentationUpdateApi,
  OtkShipmentLineApi,
  OtkShipmentLineCreateApi,
  OtkShipmentLineUpdateApi,
  OtkWorkerApi
} from "@/types/otk";

export type OtkShipmentLineUi = OtkShipmentLine & {
  sampleRule?: SampleRuleView | null;
};

export type OtkPresentationCardUi = Omit<OtkPresentationCard, "lines"> & {
  lines: OtkShipmentLineUi[];
};

export function mapWorker(api: OtkWorkerApi): OtkWorker {
  return { id: api.id, name: api.name, position: api.position };
}

export function mapLine(api: OtkShipmentLineApi): OtkShipmentLineUi {
  return {
    id: api.id,
    code: api.code ?? "",
    nomenclature: api.nomenclature ?? "",
    storageUnit: api.storage_unit ?? "шт",
    qtyUpd: Number(api.qty_upd) || 0,
    qtyFact: Number(api.qty_fact) || 0,
    category: normalizeTmcCategory(api.category),
    supplierQualityRating: api.supplier_quality_rating ?? null,
    sampleRule: sampleRuleFromApi(api.sample_rule)
  };
}

export function mapPresentation(api: OtkPresentationCardApi): OtkPresentationCardUi {
  return {
    id: api.id,
    organization: api.organization,
    purchaseOrder: api.purchase_order,
    supplier: api.supplier,
    counterparty: api.counterparty,
    warehouse: api.warehouse,
    invoiceDate: api.invoice_date,
    invoiceNumber: api.invoice_number,
    storageZone: api.storage_zone,
    presentationPlace: api.presentation_place,
    otkIncomingWarehouse: api.otk_incoming_warehouse,
    executorId: api.executor_id,
    dueAt: api.due_at,
    status: api.status,
    lines: (api.lines ?? []).map(mapLine)
  };
}

export function toPresentationUpdate(
  patch: Partial<OtkPresentationCardUi>
): OtkPresentationUpdateApi {
  const out: OtkPresentationUpdateApi = {};
  if (patch.organization !== undefined) out.organization = patch.organization;
  if (patch.purchaseOrder !== undefined) out.purchase_order = patch.purchaseOrder;
  if (patch.supplier !== undefined) out.supplier = patch.supplier;
  if (patch.counterparty !== undefined) out.counterparty = patch.counterparty;
  if (patch.warehouse !== undefined) out.warehouse = patch.warehouse;
  if (patch.invoiceDate !== undefined) out.invoice_date = patch.invoiceDate;
  if (patch.invoiceNumber !== undefined) out.invoice_number = patch.invoiceNumber;
  if (patch.storageZone !== undefined) out.storage_zone = patch.storageZone;
  if (patch.presentationPlace !== undefined) {
    out.presentation_place = patch.presentationPlace;
  }
  if (patch.otkIncomingWarehouse !== undefined) {
    out.otk_incoming_warehouse = patch.otkIncomingWarehouse;
  }
  if (patch.executorId !== undefined) out.executor_id = patch.executorId;
  if (patch.dueAt !== undefined) out.due_at = patch.dueAt;
  if (patch.status !== undefined) out.status = patch.status;
  return out;
}

export function toLineCreate(line: Partial<OtkShipmentLineUi>): OtkShipmentLineCreateApi {
  return {
    code: line.code ?? "",
    nomenclature: line.nomenclature ?? "",
    storage_unit: line.storageUnit ?? "шт",
    qty_upd: line.qtyUpd ?? 0,
    qty_fact: line.qtyFact ?? 0,
    category: normalizeTmcCategory(line.category ?? "other"),
    supplier_quality_rating: line.supplierQualityRating ?? null
  };
}

export function toLineUpdate(patch: Partial<OtkShipmentLineUi>): OtkShipmentLineUpdateApi {
  const out: OtkShipmentLineUpdateApi = {};
  if (patch.code !== undefined) out.code = patch.code;
  if (patch.nomenclature !== undefined) out.nomenclature = patch.nomenclature;
  if (patch.storageUnit !== undefined) out.storage_unit = patch.storageUnit;
  if (patch.qtyUpd !== undefined) out.qty_upd = patch.qtyUpd;
  if (patch.qtyFact !== undefined) out.qty_fact = patch.qtyFact;
  if (patch.category !== undefined) out.category = normalizeTmcCategory(patch.category);
  if (patch.supplierQualityRating !== undefined) {
    out.supplier_quality_rating = patch.supplierQualityRating;
  }
  return out;
}
