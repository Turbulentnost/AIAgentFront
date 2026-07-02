import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Circle,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
  Users
} from "lucide-react";
import LoadingPanel from "@/components/LoadingPanel";
import { useMeetingRegistry, useRefreshMeetingRegistry } from "@/hooks/useMeetingRegistry";
import { getMeetingRequestError } from "@/hooks/useMeetingDashboard";
import type { MeetingRegistryStageFilter } from "@/types/meetings";
import {
  defaultRegistryStageCounts,
  getMeetingRegistryStageIndex,
  getMeetingRegistryStageLabel,
  mapMeetingRegistryItem,
  meetingRegistryStages,
  type MeetingRegistryViewItem
} from "@/utils/meetingRegistry";
import { formatMeetingDateTime } from "@/utils/meetingDashboard";
import styles from "./MeetingAgent.module.css";

const registryFilters: { id: MeetingRegistryStageFilter; label: string }[] = [
  { id: "all", label: "Все" },
  ...meetingRegistryStages.map((stage) => ({ id: stage.id, label: stage.shortLabel }))
];

type Props = {
  canAccessAgent: boolean;
};

export default function MeetingAgentRegistry({ canAccessAgent }: Props) {
  const [stageFilter, setStageFilter] = useState<MeetingRegistryStageFilter>("all");
  const [selectedId, setSelectedId] = useState("");
  const registryQuery = useMeetingRegistry(canAccessAgent, stageFilter);
  const refreshRegistry = useRefreshMeetingRegistry();

  const items = useMemo(
    () => (registryQuery.data?.items ?? []).map(mapMeetingRegistryItem),
    [registryQuery.data?.items]
  );
  const stageCounts = registryQuery.data?.stage_counts ?? defaultRegistryStageCounts();
  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  const requestError = registryQuery.isError ? getMeetingRequestError(registryQuery.error) : null;

  useEffect(() => {
    if (!items.length) {
      setSelectedId("");
      return;
    }
    if (!items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  if (!canAccessAgent) {
    return <div className={styles.queueEmpty}>Нет доступа к реестру совещаний</div>;
  }

  if (registryQuery.isLoading) {
    return (
      <div className={styles.modalLoader}>
        <LoadingPanel title="Загружаем реестр совещаний…" />
      </div>
    );
  }

  return (
    <>
      {requestError ? (
        <div className={styles.registryStubBanner} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{requestError}</span>
        </div>
      ) : null}

      <div className={styles.registryStatsRow} aria-label="Сводка по этапам реестра">
        {meetingRegistryStages.map((stage) => (
          <article className={styles.registryStatCard} key={stage.id}>
            <strong>{stageCounts[stage.id] ?? 0}</strong>
            <span>{stage.shortLabel}</span>
          </article>
        ))}
      </div>

      <div className={`${styles.workspace} ${styles.registryWorkspace}`}>
        <aside className={`${styles.queuePanel} ${styles.registryListPanel}`} aria-labelledby="meeting-registry-list-title">
          <div className={styles.panelHead}>
            <h2 id="meeting-registry-list-title">Реестр совещаний</h2>
            <button
              type="button"
              className={`${styles.refreshButton} ${registryQuery.isFetching ? styles.refreshButtonSpinning : ""}`}
              onClick={() => void refreshRegistry()}
              disabled={registryQuery.isFetching}
              aria-label="Обновить реестр"
            >
              <RefreshCw size={15} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.registryFilters} role="tablist" aria-label="Фильтр по этапу">
            {registryFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={stageFilter === filter.id}
                className={`${styles.registryFilterTab} ${
                  stageFilter === filter.id ? styles.registryFilterTabActive : ""
                }`}
                onClick={() => setStageFilter(filter.id)}
              >
                {filter.label} — {stageCounts[filter.id] ?? 0}
              </button>
            ))}
          </div>

          <div className={styles.queueList}>
            {registryQuery.isFetching && !items.length ? (
              <div className={styles.modalLoader}>
                <Loader2 size={18} className={styles.spinner} aria-hidden="true" />
                <span>Обновляем реестр…</span>
              </div>
            ) : items.length ? (
              items.map((item) => (
                <RegistryCard
                  key={item.id}
                  item={item}
                  active={selectedId === item.id}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))
            ) : (
              <div className={styles.queueEmpty}>
                Совещений с отправленными приглашениями на выбранном этапе нет
              </div>
            )}
          </div>
        </aside>

        <section className={`${styles.detailsPanel} ${styles.registryDetailsPanel}`} aria-labelledby="meeting-registry-details-title">
          {!selectedItem ? (
            <div className={styles.detailsEmpty}>Выберите совещение из реестра</div>
          ) : (
            <RegistryDetails item={selectedItem} />
          )}
        </section>
      </div>
    </>
  );
}

function RegistryCard({
  item,
  active,
  onSelect
}: {
  item: MeetingRegistryViewItem;
  active: boolean;
  onSelect: () => void;
}) {
  const stageShortLabel =
    meetingRegistryStages.find((stage) => stage.id === item.stage)?.shortLabel ??
    getMeetingRegistryStageLabel(item.stage);
  const stageIndex = getMeetingRegistryStageIndex(item.stage);

  return (
    <button
      type="button"
      className={`${styles.queueCard} ${active ? styles.queueCardActive : ""}`}
      onClick={onSelect}
    >
      <div className={styles.queueCardHeader}>
        <strong className={styles.queueCardCode}>СЗ №{item.memoNumber}</strong>
        <span className={styles.registryStageBadgeCompact}>{stageShortLabel}</span>
      </div>
      <p className={styles.queueCardTheme}>{item.title}</p>
      <div className={styles.registryProgressDots} aria-hidden="true">
        {meetingRegistryStages.map((stage, index) => (
          <span
            key={stage.id}
            className={`${styles.registryProgressDot} ${
              index <= stageIndex ? styles.registryProgressDotDone : ""
            } ${index === stageIndex ? styles.registryProgressDotCurrent : ""}`}
          />
        ))}
      </div>
      <dl className={styles.queueCardFields}>
        <div>
          <dt>Дата совещания</dt>
          <dd>{item.meetingAtLabel}</dd>
        </div>
        <div>
          <dt>Место</dt>
          <dd>{item.location ?? "—"}</dd>
        </div>
        <div>
          <dt>Инициатор</dt>
          <dd className={styles.queueCardFieldPerson}>{item.initiator}</dd>
        </div>
        <div>
          <dt>Участники</dt>
          <dd>{item.participantsCount}</dd>
        </div>
      </dl>
    </button>
  );
}

function RegistryDetails({ item }: { item: MeetingRegistryViewItem }) {
  const currentIndex = getMeetingRegistryStageIndex(item.stage);

  return (
    <>
      <header className={styles.detailsHead}>
        <div>
          <h2 id="meeting-registry-details-title">
            СЗ №{item.memoNumber} · {item.title}
          </h2>
        </div>
        <span className={styles.registryStageBadge}>{getMeetingRegistryStageLabel(item.stage)}</span>
      </header>

      <div className={`${styles.section} ${styles.registrySection}`}>
        <h3>Этап жизненного цикла</h3>
        <ol className={styles.registryStepper} aria-label="Этапы совещания">
          {meetingRegistryStages.map((stage, index) => {
            const done = index <= currentIndex;
            const current = index === currentIndex;
            return (
              <li
                key={stage.id}
                className={`${styles.registryStep} ${done ? styles.registryStepDone : ""} ${
                  current ? styles.registryStepCurrent : ""
                }`}
              >
                <span className={styles.registryStepIcon} aria-hidden="true">
                  {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                </span>
                <span className={styles.registryStepLabel}>{stage.shortLabel}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={`${styles.section} ${styles.registrySection}`}>
        <h3>Данные совещения</h3>
        <dl className={styles.dataGrid}>
          <div>
            <dt>Дата / время</dt>
            <dd>{item.meetingAtLabel}</dd>
          </div>
          <div>
            <dt>Место</dt>
            <dd>{item.location ?? "—"}</dd>
          </div>
          <div>
            <dt>Инициатор</dt>
            <dd>{item.initiator}</dd>
          </div>
          <div>
            <dt>Руководитель</dt>
            <dd>{item.manager}</dd>
          </div>
          <div>
            <dt>Участники</dt>
            <dd>{item.participantsCount}</dd>
          </div>
          <div>
            <dt>Обновлено</dt>
            <dd>{formatMeetingDateTime(item.updatedAt)}</dd>
          </div>
        </dl>
      </div>

      <div className={`${styles.section} ${styles.registrySection}`}>
        <h3>Ключевые события</h3>
        <ul className={styles.registryEvents}>
          <li className={styles.registryEventItem}>
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>Служебная записка согласована в 1С</span>
          </li>
          <li className={styles.registryEventItem}>
            <Mail size={16} aria-hidden="true" />
            <span>Приглашения отправлены · {formatMeetingDateTime(item.invitationsSentAt)}</span>
          </li>
          {item.protocolNumber ? (
            <li className={styles.registryEventItem}>
              <FileText size={16} aria-hidden="true" />
              <span>Протокол {item.protocolNumber}</span>
            </li>
          ) : (
            <li className={`${styles.registryEventItem} ${styles.registryEventPending}`}>
              <FileText size={16} aria-hidden="true" />
              <span>Протокол ещё не создан</span>
            </li>
          )}
        </ul>
      </div>

      <div className={`${styles.section} ${styles.registrySection}`}>
        <h3>Действия</h3>
        <div className={`${styles.actionRow} ${styles.registryActionRow}`}>
          <button type="button" className={styles.ghostButton} disabled title="Скоро">
            <CalendarDays size={15} aria-hidden="true" />
            Открыть в календаре
          </button>
          <button type="button" className={styles.ghostButton} disabled title="Скоро">
            <FileText size={15} aria-hidden="true" />
            Открыть протокол
          </button>
          <button type="button" className={styles.ghostButton} disabled title="Скоро">
            <Users size={15} aria-hidden="true" />
            Список участников
          </button>
        </div>
        <p className={styles.footerNote}>
          Действия станут доступны после подключения реестра к 1С ERP и сервису протоколирования.
        </p>
      </div>
    </>
  );
}
