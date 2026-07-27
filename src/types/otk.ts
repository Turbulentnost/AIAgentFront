/** OTK worker API DTOs (snake_case, matches backend). */

export type OtkPresentationStatus = "queued" | "in_progress" | "done";

export type OtkTmcCategoryApi =
  | "electronics"
  | "metal"
  | "fasteners"
  | "cable"
  | "pipes"
  | "flanges"
  | "gaskets"
  | "drawing_parts"
  | "other";

export interface OtkSampleRuleApi {
  rule_id: string;
  category: string;
  sample_size?: number | null;
  sample_pct?: number | null;
  sample_basis?: string | null;
  sample_note?: string;
  scrap_threshold_pct?: number;
  lot_qty?: number | null;
}

export interface OtkWorkerApi {
  id: string;
  name: string;
  position: string;
}

export interface OtkShipmentLineApi {
  id: string;
  code: string;
  nomenclature: string;
  storage_unit: string;
  qty_upd: number;
  qty_fact: number;
  category: OtkTmcCategoryApi | string;
  supplier_quality_rating?: number | string | null;
  accepted?: boolean;
  sample_rule?: OtkSampleRuleApi | null;
}

export interface OtkPresentationCardApi {
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
  status: OtkPresentationStatus;
  lines: OtkShipmentLineApi[];
}

export interface OtkPresentationSummaryApi {
  id: string;
  organization: string;
  purchase_order: string;
  supplier: string;
  invoice_number: string;
  due_at: string;
  status: OtkPresentationStatus;
  lines_count: number;
  /** True when ≥1 line and every line has accepted=true. */
  all_accepted?: boolean;
  executor_id: string;
  project_code?: string | null;
  project_name?: string | null;
}

export interface OtkPresentationListApi {
  items: OtkPresentationSummaryApi[];
  pending_count: number;
  earliest_due_at: string | null;
  workers: OtkWorkerApi[];
}

export interface OtkPresentationUpdateApi {
  organization?: string;
  purchase_order?: string;
  project_code?: string | null;
  project_name?: string | null;
  supplier?: string;
  counterparty?: string;
  warehouse?: string;
  invoice_date?: string;
  invoice_number?: string;
  storage_zone?: string;
  presentation_place?: string;
  otk_incoming_warehouse?: string;
  executor_id?: string;
  due_at?: string;
  status?: OtkPresentationStatus;
}

export interface OtkShipmentLineCreateApi {
  code?: string;
  nomenclature?: string;
  storage_unit?: string;
  qty_upd?: number;
  qty_fact?: number;
  category?: OtkTmcCategoryApi | string;
  supplier_quality_rating?: number | string | null;
  accepted?: boolean;
}

export interface OtkShipmentLineUpdateApi {
  code?: string;
  nomenclature?: string;
  storage_unit?: string;
  qty_upd?: number;
  qty_fact?: number;
  category?: OtkTmcCategoryApi | string;
  supplier_quality_rating?: number | string | null;
  accepted?: boolean;
}

export interface OtkWriteTo1CResultApi {
  ok: boolean;
  stub: boolean;
  message: string;
  presentation_id?: string | null;
}
