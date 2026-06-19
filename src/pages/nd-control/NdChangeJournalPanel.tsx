import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { ndControlApi } from "@/api/endpoints";
import type {
  NdChangeJournalEntry,
  NdChangeJournalEventType,
  NdControlDepartment,
  NdControlTemplate
} from "@/types";
import NdControlDataTable from "./NdControlDataTable";
import { ND_CHANGE_JOURNAL_EVENT_LABELS } from "./constants";
import styles from "../NdControlAgent.module.css";

type Props = {
  open: boolean;
  departments: NdControlDepartment[];
  templates: NdControlTemplate[];
  onClose: () => void;
};

const PAGE_SIZE = 20;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function displayDocument(entry: NdChangeJournalEntry) {
  if (entry.document_code && entry.document_name) return `${entry.document_code} · ${entry.document_name}`;
  return entry.document_code || entry.document_name || "—";
}

function toDateTimeStart(value: string) {
  return value ? `${value}T00:00:00` : undefined;
}

function toDateTimeEnd(value: string) {
  return value ? `${value}T23:59:59` : undefined;
}

export default function NdChangeJournalPanel({ open, departments, templates, onClose }: Props) {
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [eventType, setEventType] = useState<NdChangeJournalEventType | "">("");
  const [departmentId, setDepartmentId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const journal = useQuery({
    queryKey: ["nd-control", "change-journal", page, dateFrom, dateTo, eventType, departmentId, templateId, search],
    queryFn: () =>
      ndControlApi.listChangeJournal({
        date_from: toDateTimeStart(dateFrom),
        date_to: toDateTimeEnd(dateTo),
        event_type: eventType || undefined,
        department_id: departmentId || undefined,
        template_id: templateId || undefined,
        search: search || undefined,
        page,
        size: PAGE_SIZE
      }),
    enabled: open
  });

  const selectedEntry = useQuery({
    queryKey: ["nd-control", "change-journal", selectedEntryId],
    queryFn: () => ndControlApi.getChangeJournalEntry(selectedEntryId!),
    enabled: open && Boolean(selectedEntryId)
  });

  const departmentMap = useMemo(() => new Map(departments.map((dept) => [dept.id, dept.name])), [departments]);
  const templateMap = useMemo(() => new Map(templates.map((template) => [template.id, template.name])), [templates]);
  const totalPages = Math.max(1, Math.ceil((journal.data?.total ?? 0) / PAGE_SIZE));

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.journalPanel} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2>Журнал изменений НД</h2>
            <p className={styles.modalText}>События шаблонов, отделов и workflow изменений.</p>
          </div>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Закрыть журнал">
            <X size={16} />
          </button>
        </div>

        <div className={styles.journalFilters}>
          <label>
            <span>С даты</span>
            <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} />
          </label>
          <label>
            <span>По дату</span>
            <input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
          </label>
          <label>
            <span>Событие</span>
            <select value={eventType} onChange={(event) => { setEventType(event.target.value as NdChangeJournalEventType | ""); setPage(1); }}>
              <option value="">Все события</option>
              {Object.entries(ND_CHANGE_JOURNAL_EVENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Отдел</span>
            <select value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setPage(1); }}>
              <option value="">Все отделы</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Шаблон</span>
            <select value={templateId} onChange={(event) => { setTemplateId(event.target.value); setPage(1); }}>
              <option value="">Все шаблоны</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Поиск</span>
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Документ, summary, ID" />
          </label>
        </div>

        <div className={styles.journalGrid}>
          <div className={styles.journalTableBlock}>
            {journal.isLoading ? (
              <p className={styles.emptyHint}>Загрузка журнала…</p>
            ) : !journal.data?.items.length ? (
              <p className={styles.emptyHint}>Записи журнала не найдены.</p>
            ) : (
              <NdControlDataTable>
                <thead className={styles.tableHead}>
                  <tr>
                    <th>Дата</th>
                    <th>Событие</th>
                    <th>Документ</th>
                    <th>Отдел/шаблон</th>
                    <th>Автор</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.data.items.map((entry) => (
                    <tr
                      key={entry.id}
                      className={entry.id === selectedEntryId ? styles.processRowSelected : undefined}
                      onClick={() => setSelectedEntryId(entry.id)}
                    >
                      <td className={styles.cellNowrap}>{formatDate(entry.created_at)}</td>
                      <td>{ND_CHANGE_JOURNAL_EVENT_LABELS[entry.event_type] ?? entry.event_type}</td>
                      <td>{displayDocument(entry)}</td>
                      <td>
                        {entry.department_id ? departmentMap.get(entry.department_id) ?? entry.department_id : null}
                        {entry.template_id ? templateMap.get(entry.template_id) ?? entry.template_id : null}
                        {!entry.department_id && !entry.template_id ? "—" : null}
                      </td>
                      <td>{entry.actor_user_id ?? "system"}</td>
                      <td>{entry.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </NdControlDataTable>
            )}
            <div className={styles.paginationRow}>
              <span>{journal.data?.total ?? 0} записей</span>
              <div className={styles.actionsCell}>
                <button type="button" className={styles.secondaryBtn} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  Назад
                </button>
                <span className={styles.badgeNeutral}>{page} / {totalPages}</span>
                <button type="button" className={styles.secondaryBtn} disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                  Вперёд
                </button>
              </div>
            </div>
          </div>

          <aside className={styles.journalDetail}>
            <h3>Детали</h3>
            {selectedEntry.isLoading ? (
              <p className={styles.emptyHint}>Загрузка записи…</p>
            ) : selectedEntry.data ? (
              <>
                <p>{selectedEntry.data.summary}</p>
                <pre>{JSON.stringify(selectedEntry.data.payload ?? {}, null, 2)}</pre>
              </>
            ) : (
              <p className={styles.emptyHint}>Выберите строку журнала.</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
