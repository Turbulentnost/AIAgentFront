import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Building2, Plus, Trash2, UserRound, X } from "lucide-react";
import { departmentsApi, knowledgeBasesApi } from "@/api/endpoints";
import { FormSearchInput, FormSelect } from "@/components/form-controls";
import type {
  KnowledgeBaseAccessGrantInput,
  KnowledgeBaseAccessType,
  KnowledgeBaseListItem,
  ResponsibleUser
} from "@/types";
import styles from "@/pages/KnowledgeBase.module.css";

type AccessView = "department" | "account";

type EditableGrant = {
  localId: string;
  grantee_type: "department" | "user";
  grantee_id: string;
  grantee_label: string;
  access_type: KnowledgeBaseAccessType;
  include_child_departments: boolean;
};

const addSubjectTypeOptions = [
  { value: "department", label: "Подразделение" },
  { value: "account", label: "Учётная запись" }
];

const accessLevelOptions: { value: KnowledgeBaseAccessType; label: string }[] = [
  { value: "read", label: "Просмотр карточки" },
  { value: "search", label: "Поиск" },
  { value: "use_via_agent", label: "Поиск и цитирование" },
  { value: "manage_sources", label: "Управление источниками" },
  { value: "reindex", label: "Переиндексация" },
  { value: "manage_access", label: "Управление доступом" },
  { value: "admin", label: "Администратор базы" }
];

function createLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatShortPersonName(fullName?: string | null): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "—";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const [lastName, ...rest] = parts;
  const initials = rest.map((part) => `${part.charAt(0).toUpperCase()}.`).join(" ");
  return `${lastName} ${initials}`.trim();
}

function grantsToEditable(
  grants: KnowledgeBaseAccessGrantInput[],
  departmentsById: Map<string, string>,
  usersById: Map<string, ResponsibleUser>
): EditableGrant[] {
  return grants
    .filter((grant) => grant.grantee_id && (grant.grantee_type === "department" || grant.grantee_type === "user"))
    .map((grant) => ({
      localId: createLocalId(),
      grantee_type: grant.grantee_type as "department" | "user",
      grantee_id: grant.grantee_id!,
      grantee_label:
        grant.grantee_type === "department"
          ? departmentsById.get(grant.grantee_id!) ?? grant.grantee_id!
          : formatShortPersonName(usersById.get(grant.grantee_id!)?.full_name),
      access_type: grant.access_type,
      include_child_departments: Boolean(grant.include_child_departments)
    }));
}

function toGrantPayload(grant: EditableGrant): KnowledgeBaseAccessGrantInput {
  return {
    grantee_type: grant.grantee_type,
    grantee_id: grant.grantee_id,
    access_type: grant.access_type,
    include_child_departments: grant.grantee_type === "department" ? grant.include_child_departments : false
  };
}

export function KnowledgeBaseAccessEditor(props: {
  knowledgeBase: KnowledgeBaseListItem;
  grants: KnowledgeBaseAccessGrantInput[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<AccessView>("department");
  const [departmentGrants, setDepartmentGrants] = useState<EditableGrant[]>([]);
  const [userGrants, setUserGrants] = useState<EditableGrant[]>([]);
  const [addQuery, setAddQuery] = useState("");
  const [addSubjectType, setAddSubjectType] = useState<"department" | "account">("department");
  const [newAccessLevel, setNewAccessLevel] = useState<KnowledgeBaseAccessType>("search");
  const [includeChildren, setIncludeChildren] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: departmentsApi.list
  });

  const usersQuery = useQuery({
    queryKey: ["knowledge-base-responsible-users"],
    queryFn: () => knowledgeBasesApi.listResponsibleUsers()
  });

  const departmentsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const department of departmentsQuery.data ?? []) {
      map.set(department.id, department.name);
    }
    return map;
  }, [departmentsQuery.data]);

  const usersById = useMemo(() => {
    const map = new Map<string, ResponsibleUser>();
    for (const user of usersQuery.data ?? []) {
      map.set(user.id, user);
    }
    return map;
  }, [usersQuery.data]);

  useEffect(() => {
    const editable = grantsToEditable(props.grants, departmentsById, usersById);
    setDepartmentGrants(editable.filter((grant) => grant.grantee_type === "department"));
    setUserGrants(editable.filter((grant) => grant.grantee_type === "user"));
  }, [props.grants, props.knowledgeBase.id, departmentsById, usersById]);

  const departmentGrantIds = useMemo(
    () => new Set(departmentGrants.map((grant) => grant.grantee_id)),
    [departmentGrants]
  );

  const directUserGrantIds = useMemo(
    () => new Set(userGrants.map((grant) => grant.grantee_id)),
    [userGrants]
  );

  const inheritedAccounts = useMemo(() => {
    const items: Array<{
      user: ResponsibleUser;
      departmentName: string;
      accessType: KnowledgeBaseAccessType;
    }> = [];

    for (const user of usersQuery.data ?? []) {
      if (!user.department_id || !departmentGrantIds.has(user.department_id) || directUserGrantIds.has(user.id)) {
        continue;
      }
      const departmentGrant = departmentGrants.find((grant) => grant.grantee_id === user.department_id);
      items.push({
        user,
        departmentName: departmentsById.get(user.department_id) ?? user.department_name ?? "—",
        accessType: departmentGrant?.access_type ?? "search"
      });
    }

    return items.sort((left, right) =>
      formatShortPersonName(left.user.full_name).localeCompare(formatShortPersonName(right.user.full_name), "ru")
    );
  }, [usersQuery.data, departmentGrantIds, directUserGrantIds, departmentGrants, departmentsById]);

  const departmentCandidates = useMemo(() => {
    const query = addQuery.trim().toLowerCase();
    return (departmentsQuery.data ?? [])
      .filter((department) => !departmentGrantIds.has(department.id))
      .filter((department) => !query || department.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [departmentsQuery.data, departmentGrantIds, addQuery]);

  const accountCandidates = useMemo(() => {
    const query = addQuery.trim().toLowerCase();
    return (usersQuery.data ?? [])
      .filter((user) => !directUserGrantIds.has(user.id))
      .filter((user) => {
        if (!query) return true;
        const haystack = [
          user.full_name,
          user.position,
          user.department_name
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [usersQuery.data, directUserGrantIds, addQuery]);

  const candidates = addSubjectType === "department" ? departmentCandidates : accountCandidates;

  const saveMutation = useMutation({
    mutationFn: () => {
      const preserved = props.grants.filter(
        (grant) => grant.grantee_type !== "department" && grant.grantee_type !== "user"
      );
      return knowledgeBasesApi.updateAccess(props.knowledgeBase.id, {
        grants: [...preserved, ...departmentGrants.map(toGrantPayload), ...userGrants.map(toGrantPayload)]
      });
    },
    onSuccess: async () => {
      setSaveError(null);
      await queryClient.invalidateQueries({ queryKey: ["knowledge-base-access", props.knowledgeBase.id] });
      await queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      await queryClient.invalidateQueries({ queryKey: ["knowledge-base-audit", props.knowledgeBase.id] });
      props.onClose();
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        const detail = error.response?.data?.detail;
        if (typeof detail === "string" && detail.trim()) {
          setSaveError(detail);
          return;
        }
      }
      setSaveError("Не удалось сохранить права доступа.");
    }
  });

  function updateGrantLevel(localId: string, accessType: KnowledgeBaseAccessType) {
    if (view === "department") {
      setDepartmentGrants((items) =>
        items.map((item) => (item.localId === localId ? { ...item, access_type: accessType } : item))
      );
      return;
    }
    setUserGrants((items) =>
      items.map((item) => (item.localId === localId ? { ...item, access_type: accessType } : item))
    );
  }

  function toggleIncludeChildren(localId: string, value: boolean) {
    setDepartmentGrants((items) =>
      items.map((item) => (item.localId === localId ? { ...item, include_child_departments: value } : item))
    );
  }

  function removeGrant(localId: string) {
    if (view === "department") {
      setDepartmentGrants((items) => items.filter((item) => item.localId !== localId));
      return;
    }
    setUserGrants((items) => items.filter((item) => item.localId !== localId));
  }

  function resetAddForm() {
    setAddQuery("");
    setNewAccessLevel("search");
    setIncludeChildren(false);
  }

  function closeAddPanel() {
    setIsAddOpen(false);
    resetAddForm();
  }

  function openAddPanel() {
    setAddSubjectType(view === "department" ? "department" : "account");
    resetAddForm();
    setIsAddOpen(true);
  }

  function addGrant(subjectId?: string) {
    const targetId = subjectId;
    if (!targetId) return;

    if (addSubjectType === "department") {
      const department = departmentsQuery.data?.find((item) => item.id === targetId);
      if (!department) return;
      setDepartmentGrants((items) => [
        ...items,
        {
          localId: createLocalId(),
          grantee_type: "department",
          grantee_id: department.id,
          grantee_label: department.name,
          access_type: newAccessLevel,
          include_child_departments: includeChildren
        }
      ]);
      if (view !== "department") setView("department");
    } else {
      const user = usersQuery.data?.find((item) => item.id === targetId);
      if (!user) return;
      setUserGrants((items) => [
        ...items,
        {
          localId: createLocalId(),
          grantee_type: "user",
          grantee_id: user.id,
          grantee_label: formatShortPersonName(user.full_name),
          access_type: newAccessLevel,
          include_child_departments: false
        }
      ]);
      if (view !== "account") setView("account");
    }

    closeAddPanel();
  }

  const activeGrants = view === "department" ? departmentGrants : userGrants;
  const isLoading = departmentsQuery.isLoading || usersQuery.isLoading;

  return (
    <div className={styles.accessEditor}>
      <header className={styles.accessEditorHeader}>
        <div>
          <h3>Редактирование доступа</h3>
          <p>Настройте подразделения и учётные записи, которым доступна база знаний «{props.knowledgeBase.name}».</p>
        </div>
        <button type="button" className={styles.iconButton} onClick={props.onClose} title="Закрыть редактирование">
          <X size={17} />
        </button>
      </header>

      <div className={styles.accessEditorTabs} role="tablist" aria-label="Тип субъекта доступа">
        <button
          type="button"
          role="tab"
          aria-selected={view === "department"}
          className={view === "department" ? styles.accessEditorTabActive : styles.accessEditorTab}
          onClick={() => {
            setView("department");
            closeAddPanel();
          }}
        >
          <Building2 size={15} strokeWidth={2} aria-hidden="true" />
          Подразделение
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "account"}
          className={view === "account" ? styles.accessEditorTabActive : styles.accessEditorTab}
          onClick={() => {
            setView("account");
            closeAddPanel();
          }}
        >
          <UserRound size={15} strokeWidth={2} aria-hidden="true" />
          Должность
        </button>
      </div>

      {isLoading ? (
        <div className={styles.accessEditorLoading}>Загрузка данных доступа…</div>
      ) : (
        <>
          <section className={styles.accessEditorSection}>
            <div className={styles.accessEditorSectionHead}>
              <h4>{view === "department" ? "Подразделения с доступом" : "Учётные записи с прямым доступом"}</h4>
              <button
                type="button"
                className={`${styles.iconButton} ${isAddOpen ? styles.iconButtonActive : ""}`}
                onClick={() => (isAddOpen ? closeAddPanel() : openAddPanel())}
                title={view === "department" ? "Добавить подразделение" : "Добавить учётную запись"}
                aria-expanded={isAddOpen}
              >
                <Plus size={16} strokeWidth={2.2} />
              </button>
            </div>

            {isAddOpen ? (
              <div className={styles.accessEditorAddInline}>
                <div className={styles.accessEditorSearchCombo}>
                  <FormSelect
                    compact
                    className={styles.accessEditorSubjectSelect}
                    value={addSubjectType}
                    onChange={(value) => {
                      setAddSubjectType(value as "department" | "account");
                      setAddQuery("");
                    }}
                    options={addSubjectTypeOptions}
                    ariaLabel="Тип субъекта"
                  />
                  <FormSearchInput
                    compact
                    className={styles.accessEditorSearchInput}
                    value={addQuery}
                    onChange={(value) => setAddQuery(value)}
                    placeholder={
                      addSubjectType === "department"
                        ? "Начните вводить название подразделения"
                        : "Начните вводить ФИО, должность или отдел"
                    }
                  />
                </div>
                <div className={styles.accessEditorAddOptions}>
                  <FormSelect
                    compact
                    value={newAccessLevel}
                    onChange={(value) => setNewAccessLevel(value as KnowledgeBaseAccessType)}
                    options={accessLevelOptions}
                    ariaLabel="Уровень доступа для новой записи"
                  />
                  {addSubjectType === "department" ? (
                    <label className={styles.accessEditorCheckboxInline}>
                      <input
                        type="checkbox"
                        checked={includeChildren}
                        onChange={(event) => setIncludeChildren(event.target.checked)}
                      />
                      Включая дочерние подразделения
                    </label>
                  ) : null}
                </div>
                {candidates.length > 0 ? (
                  <div className={styles.accessEditorCandidates}>
                    {candidates.map((item) => {
                      const id = item.id;
                      const label =
                        addSubjectType === "department"
                          ? "name" in item
                            ? item.name
                            : id
                          : formatShortPersonName("full_name" in item ? item.full_name : null);
                      const meta =
                        addSubjectType === "account" && "position" in item
                          ? [item.position, item.department_name].filter(Boolean).join(" · ")
                          : null;

                      return (
                        <button
                          key={id}
                          type="button"
                          className={styles.accessEditorCandidate}
                          onClick={() => addGrant(id)}
                        >
                          <strong>{label}</strong>
                          {meta ? <span>{meta}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : addQuery.trim() ? (
                  <p className={styles.accessEditorEmpty}>Ничего не найдено.</p>
                ) : null}
              </div>
            ) : null}

            {!activeGrants.length && !isAddOpen ? (
              <p className={styles.accessEditorEmpty}>
                {view === "department"
                  ? "Подразделения ещё не назначены."
                  : "Прямой доступ для учётных записей ещё не настроен."}
              </p>
            ) : activeGrants.length ? (
              <div className={styles.accessEditorTable} role="table">
                <div
                  className={`${styles.accessEditorHead} ${view === "account" ? styles.accessEditorHeadAccount : ""}`}
                  role="row"
                >
                  <span role="columnheader">{view === "department" ? "Подразделение" : "Учётная запись"}</span>
                  <span role="columnheader">Уровень доступа</span>
                  {view === "department" ? <span role="columnheader">Дочерние</span> : null}
                  <span role="columnheader" aria-label="Действия" />
                </div>
                {activeGrants.map((grant) => (
                  <div
                    className={`${styles.accessEditorRow} ${view === "account" ? styles.accessEditorRowAccount : ""}`}
                    role="row"
                    key={grant.localId}
                  >
                    <div className={styles.accessEditorSubject} role="cell">
                      <strong>{grant.grantee_label}</strong>
                      {view === "account" ? (
                        <span>{usersById.get(grant.grantee_id)?.position?.trim() || "—"}</span>
                      ) : null}
                    </div>
                    <div role="cell">
                      <FormSelect
                        compact
                        value={grant.access_type}
                        onChange={(value) => updateGrantLevel(grant.localId, value as KnowledgeBaseAccessType)}
                        options={accessLevelOptions}
                        ariaLabel="Уровень доступа"
                      />
                    </div>
                    {view === "department" ? (
                      <label className={styles.accessEditorCheckbox} role="cell">
                        <input
                          type="checkbox"
                          checked={grant.include_child_departments}
                          onChange={(event) => toggleIncludeChildren(grant.localId, event.target.checked)}
                        />
                        Да
                      </label>
                    ) : null}
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.dangerButton}`}
                      onClick={() => removeGrant(grant.localId)}
                      title="Удалить доступ"
                      role="cell"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {view === "account" && inheritedAccounts.length > 0 ? (
            <section className={styles.accessEditorSection}>
              <h4>Доступ через подразделение</h4>
              <p className={styles.accessEditorHint}>
                Эти учётные записи получают доступ автоматически, потому что относятся к подразделениям из списка
                выше.
              </p>
              <div className={styles.accessEditorInheritedList}>
                {inheritedAccounts.map(({ user, departmentName, accessType }) => (
                  <article className={styles.accessEditorInheritedItem} key={user.id}>
                    <div>
                      <strong>{formatShortPersonName(user.full_name)}</strong>
                      <span>{user.position?.trim() || "—"}</span>
                    </div>
                    <div className={styles.accessEditorInheritedMeta}>
                      <span>{departmentName}</span>
                      <span>{accessLevelOptions.find((item) => item.value === accessType)?.label ?? accessType}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {saveError ? <div className={styles.accessEditorError}>{saveError}</div> : null}

      <footer className={styles.accessEditorFooter}>
        <button type="button" className={styles.secondaryButton} onClick={props.onClose} disabled={saveMutation.isPending}>
          Отмена
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isLoading}
        >
          {saveMutation.isPending ? "Сохраняем…" : "Сохранить доступ"}
        </button>
      </footer>
    </div>
  );
}
