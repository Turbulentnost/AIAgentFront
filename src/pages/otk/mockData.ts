/** Mock types and sample data for OTK worker 1C presentation cards.
 * Seed JSON is generated from AIAgentBack/.../data/otk_presentations.json
 * (see AIAgentBack/scripts/_gen_otk_presentations_seed.py).
 */

import seed from "./otk_presentations.seed.json";

export type OtkTmcCategory =
  | "electronics"
  | "metal"
  | "fasteners"
  | "cable"
  | "pipes"
  | "flanges"
  | "gaskets"
  | "drawing_parts"
  | "other";

export type OtkWorker = {
  id: string;
  name: string;
  position: string;
};

export type OtkShipmentLine = {
  id: string;
  code: string;
  nomenclature: string;
  storageUnit: string;
  qtyUpd: number;
  qtyFact: number;
  category: OtkTmcCategory;
  supplierQualityRating?: number | string | null;
  /** ╨Ю╤В╨╝╨╡╤В╨║╨░ ╨┐╤А╨╕╤С╨╝╨║╨╕ ╨┐╨╛╨╖╨╕╤Ж╨╕╨╕ (╨╗╨╛╨║╨░╨╗╤М╨╜╨░╤П; seed ╨╝╨╛╨╢╨╡╤В ╨▓╤Л╨▓╨╡╤Б╤В╨╕ ╨╕╨╖ 1C). */
  accepted?: boolean;
};

export type OtkPresentationCard = {
  id: string;
  organization: string;
  purchaseOrder: string;
  projectCode?: string | null;
  projectName?: string | null;
  supplier: string;
  counterparty: string;
  warehouse: string;
  invoiceDate: string;
  invoiceNumber: string;
  storageZone: string;
  presentationPlace: string;
  otkIncomingWarehouse: string;
  executorId: string;
  dueAt: string;
  status: "queued" | "in_progress" | "done";
  lines: OtkShipmentLine[];
};

type SeedLine = {
  id: string;
  code: string;
  nomenclature: string;
  storage_unit: string;
  qty_upd: number;
  qty_fact: number;
  category: string;
  supplier_quality_rating?: number | string | null;
  accepted?: boolean;
};

type SeedCard = {
  id: string;
  organization: string;
  purchase_order: string;
  project_code?: string | null;
  project_name?: string | null;
  supplier: string;
  counterparty: string;
  warehouse: string;
  invoice_date: string;
  invoice_number: string;
  storage_zone: string;
  presentation_place: string;
  otk_incoming_warehouse: string;
  executor_id: string;
  due_at: string;
  status: "queued" | "in_progress" | "done";
  lines: SeedLine[];
};

type SeedPayload = {
  workers: OtkWorker[];
  presentations: SeedCard[];
};

const seedPayload = seed as SeedPayload;

function mapSeedLine(line: SeedLine): OtkShipmentLine {
  return {
    id: line.id,
    code: line.code,
    nomenclature: line.nomenclature,
    storageUnit: line.storage_unit,
    qtyUpd: line.qty_upd,
    qtyFact: line.qty_fact,
    category: line.category as OtkTmcCategory,
    supplierQualityRating: line.supplier_quality_rating ?? null,
    accepted: Boolean(line.accepted)
  };
}

function mapSeedCard(card: SeedCard): OtkPresentationCard {
  return {
    id: card.id,
    organization: card.organization,
    purchaseOrder: card.purchase_order,
    projectCode: card.project_code ?? null,
    projectName: card.project_name ?? null,
    supplier: card.supplier,
    counterparty: card.counterparty,
    warehouse: card.warehouse,
    invoiceDate: card.invoice_date,
    invoiceNumber: card.invoice_number,
    storageZone: card.storage_zone,
    presentationPlace: card.presentation_place,
    otkIncomingWarehouse: card.otk_incoming_warehouse,
    executorId: card.executor_id,
    dueAt: card.due_at,
    status: card.status,
    lines: (card.lines ?? []).map(mapSeedLine)
  };
}

export const OTK_WORKERS: OtkWorker[] = seedPayload.workers;

export const MOCK_PRESENTATIONS: OtkPresentationCard[] =
  seedPayload.presentations.map(mapSeedCard);

export function findWorker(id: string): OtkWorker | undefined {
  return OTK_WORKERS.find((worker) => worker.id === id);
}
