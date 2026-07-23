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

export const MOCK_PRESENTATIONS: OtkPresentationCard[] = [
  {
    id: "pres-001",
    organization: "ООО НПО «Турбулентность-Дон»",
    purchaseOrder: "ЗП-0001247",
    supplier: "ООО «МеталлСервис»",
    counterparty: "ООО «МеталлСервис»",
    warehouse: "Склад сырья №1",
    invoiceDate: "2026-07-21",
    invoiceNumber: "УПД-45821",
    storageZone: "Зона приёмки А",
    presentationPlace: "Участок входного контроля",
    otkIncomingWarehouse: "Склад входного контроля ОТК",
    executorId: "otk-w-1",
    dueAt: "2026-07-23T17:00:00+03:00",
    status: "queued",
    lines: [
      {
        id: "l1",
        code: "10.01.00125",
        nomenclature: "Лист стальной 3 мм Ст3",
        storageUnit: "шт",
        qtyUpd: 120,
        qtyFact: 120,
        category: "metal"
      },
      {
        id: "l2",
        code: "10.01.00402",
        nomenclature: "Труба бесшовная Ø57×3,5",
        storageUnit: "м",
        qtyUpd: 48,
        qtyFact: 48,
        category: "pipes"
      }
    ]
  },
  {
    id: "pres-002",
    organization: "ООО НПО «Турбулентность-Дон»",
    purchaseOrder: "ЗП-0001302",
    supplier: "АО «КабельПром»",
    counterparty: "АО «КабельПром»",
    warehouse: "Склад комплектующих",
    invoiceDate: "2026-07-20",
    invoiceNumber: "УПД-11209",
    storageZone: "Зона приёмки Б",
    presentationPlace: "Стол предъявления №2",
    otkIncomingWarehouse: "Склад входного контроля ОТК",
    executorId: "otk-w-2",
    dueAt: "2026-07-22T16:00:00+03:00",
    status: "in_progress",
    lines: [
      {
        id: "l3",
        code: "20.05.00088",
        nomenclature: "Кабель ВВГнг 3×2,5",
        storageUnit: "м",
        qtyUpd: 500,
        qtyFact: 498,
        category: "cable",
        supplierQualityRating: 40
      },
      {
        id: "l4",
        code: "30.02.00015",
        nomenclature: "Болт М8×40 DIN 933",
        storageUnit: "шт",
        qtyUpd: 2000,
        qtyFact: 2000,
        category: "fasteners"
      }
    ]
  },
  {
    id: "pres-003",
    organization: "ООО НПО «Турбулентность-Дон»",
    purchaseOrder: "ЗП-0001310",
    supplier: "ООО «ЭлектроКомпонент»",
    counterparty: "ООО «ЭлектроКомпонент»",
    warehouse: "Склад электроники",
    invoiceDate: "2026-07-22",
    invoiceNumber: "УПД-9901",
    storageZone: "Зона приёмки В",
    presentationPlace: "Участок входного контроля",
    otkIncomingWarehouse: "Склад входного контроля ОТК",
    executorId: "otk-w-3",
    dueAt: "2026-07-25T17:00:00+03:00",
    status: "queued",
    lines: [
      {
        id: "l5",
        code: "40.11.00003",
        nomenclature: "Микросхема STM32F103",
        storageUnit: "шт",
        qtyUpd: 80,
        qtyFact: 80,
        category: "electronics"
      }
    ]
  }
];

export function findWorker(id: string): OtkWorker | undefined {
  return OTK_WORKERS.find((worker) => worker.id === id);
}
