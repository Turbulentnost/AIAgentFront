import type { ReactNode } from "react";
import type { OtkPresentationCard, OtkWorker } from "./mockData";
import styles from "./OtkWorker.module.css";

type Props = {
  card: OtkPresentationCard;
  workers: OtkWorker[];
  onChange: (patch: Partial<OtkPresentationCard>) => void;
};

function toDateInputValue(value: string) {
  if (!value) return "";
  return value.slice(0, 10);
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateTimeLocalValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

type FieldTone = "default" | "sand";

type FieldProps = {
  label: string;
  tone?: FieldTone;
  children: ReactNode;
};

function Field({ label, tone = "default", children }: FieldProps) {
  const toneClass = tone === "sand" ? styles.fieldSand : "";
  return (
    <label className={`${styles.field} ${toneClass}`.trim()} data-tone={tone}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  tone,
  onChange
}: {
  label: string;
  value: string;
  tone?: FieldTone;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} tone={tone}>
      <input
        className={styles.fieldControl}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function OtkPresentationCardView({ card, workers, onChange }: Props) {
  return (
    <div className={styles.headerColumns}>
      <div className={styles.headerColumn}>
        <TextField
          label="Организация"
          value={card.organization}
          onChange={(organization) => onChange({ organization })}
        />
        <TextField
          label="Заказ поставщику"
          value={card.purchaseOrder}
          tone="sand"
          onChange={(purchaseOrder) => onChange({ purchaseOrder })}
        />
        <div className={styles.fieldGroup}>
          <TextField
            label="Поставщик"
            value={card.supplier}
            tone="sand"
            onChange={(supplier) => onChange({ supplier })}
          />
          <TextField
            label="Контрагент"
            value={card.counterparty}
            tone="sand"
            onChange={(counterparty) => onChange({ counterparty })}
          />
          <TextField
            label="Склад"
            value={card.warehouse}
            onChange={(warehouse) => onChange({ warehouse })}
          />
        </div>
      </div>

      <div className={`${styles.headerColumn} ${styles.fieldGroup}`}>
        <Field label="Вх. дата накладной">
          <input
            className={styles.fieldControl}
            type="date"
            value={toDateInputValue(card.invoiceDate)}
            onChange={(e) => onChange({ invoiceDate: e.target.value })}
          />
        </Field>
        <TextField
          label="Вх. № накладной"
          value={card.invoiceNumber}
          onChange={(invoiceNumber) => onChange({ invoiceNumber })}
        />
        <TextField
          label="Зона хранения"
          value={card.storageZone}
          onChange={(storageZone) => onChange({ storageZone })}
        />
        <TextField
          label="Место предъявления"
          value={card.presentationPlace}
          onChange={(presentationPlace) => onChange({ presentationPlace })}
        />
      </div>

      <div className={`${styles.headerColumn} ${styles.fieldGroup}`}>
        <TextField
          label="Склад входного контроля ОТК"
          value={card.otkIncomingWarehouse}
          onChange={(otkIncomingWarehouse) => onChange({ otkIncomingWarehouse })}
        />
        <Field label="Исполнитель (ОТК)">
          <select
            className={styles.fieldControl}
            value={card.executorId}
            onChange={(e) => onChange({ executorId: e.target.value })}
          >
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name} ({worker.position})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Срок исполнения">
          <input
            className={styles.fieldControl}
            type="datetime-local"
            value={toDateTimeLocalValue(card.dueAt)}
            onChange={(e) => onChange({ dueAt: fromDateTimeLocalValue(e.target.value) })}
          />
        </Field>
      </div>
    </div>
  );
}
