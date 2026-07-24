/** Mock types and sample data for OTK worker 1C presentation cards. */

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
};

export type OtkPresentationCard = {
  id: string;
  organization: string;
  purchaseOrder: string;
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

export const OTK_WORKERS: OtkWorker[] = [
  { id: "otk-w-1", name: "Иванова А.С.", position: "Инженер по качеству" },
  { id: "otk-w-2", name: "Петров Д.И.", position: "Инженер по качеству" },
  { id: "otk-w-3", name: "Сидорова М.В.", position: "Инженер ОТК" }
];

/** Empty by default — OTK cards come from API / orchestrator handoff. */
export const MOCK_PRESENTATIONS: OtkPresentationCard[] = [];

export function findWorker(id: string): OtkWorker | undefined {
  return OTK_WORKERS.find((worker) => worker.id === id);
}
