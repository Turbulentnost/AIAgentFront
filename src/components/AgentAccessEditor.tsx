import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Building2, Plus, Trash2, UserRound, X } from "lucide-react";
import { agentsApi, departmentsApi, usersApi } from "@/api/endpoints";
import { FormSearchInput, FormSelect } from "@/components/form-controls";
import type {
  AgentAccess,
  AgentDepartmentGrant,
  AgentDepartmentGrantInput,
  AgentPermissionLevel,
  AgentUserGrantInput,
  ResponsibleUser
} from "@/types";
import styles from "@/pages/Agents.module.css";

type AccessView = "department" | "account";

type EditableDepartmentGrant = {
  localId: string;
  department_id: string;
  label: string;
  level: AgentPermissionLevel;
};

type EditableUserGrant = {
  localId: string;
  user_id: string;
  label: string;
  level: AgentPermissionLevel;
};

const addSubjectTypeOptions = [
  { value: "department", label: "Подразделение" },
  { value: "account", label: "Учётная запись" }
];

const permissionLevelOptions: { value: AgentPermissionLevel; label: string }[] = [
  { value: "run", label: "Запуск" },
  { value: "view_results", label: "Просмотр результатов" },
  { value: "approve", label: "Согласование" },
  { value: "configure", label: "Настройка" }
];

const compactPermissionLevelOptions: { value: AgentPermissionLevel; label: string }[] = [
  { value: "run", label: "Запуск" },
  { value: "view_results", label: "Просмотр" },
  { value: "approve", label: "Соглас." },
  { value: "configure", label: "Настройка" }
];

const compactAddSubjectTypeOptions = [
  { value: "department", label: "Отдел" },
  { value: "account", label: "Аккаунт" }
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

function flagsToLevel(
  grant: Pick<AgentDepartmentGrant, "can_run" | "can_view_results" | "can_approve" | "can_configure">
): AgentPermissionLevel {
  if (grant.can_configure) return "configure";
  if (grant.can_approve) return "approve";
  if (grant.can_view_results) return "view_results";
  return "run";
}

function levelToFlags(level: AgentPermissionLevel) {
  switch (level) {
    case "configure":
      return { access_level: "configure", can_run: true, can_view_results: true, can_approve: true, can_configure: true };
    case "approve":
      return { access_level: "approve", can_run: true, can_view_results: true, can_approve: true, can_configure: false };
    case "view_results":
      return { access_level: "view_results", can_run: true, can_view_results: true, can_approve: false, can_configure: false };
    default:
      return { access_level: "run", can_run: true, can_view_results: false, can_approve: false, can_configure: false };
  }
}

function toDepartmentPayload(grant: EditableDepartmentGrant): AgentDepartmentGrantInput {
  return {
    department_id: grant.department_id,
    ...levelToFlags(grant.level)
  };
}

function toUserPayload(grant: EditableUserGrant): AgentUserGrantInput {
  return {
    user_id: grant.user_id,
    ...levelToFlags(grant.level)
  };
}

export function AgentAccessEditor(props: {
  agent: AgentAccess;
  compact?: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<AccessView>("department");
  const [departmentGrants, setDepartmentGrants] = useState<EditableDepartmentGrant[]>([]);
  const [userGrants, setUserGrants] = useState<EditableUserGrant[]>([]);
  const [addQuery, setAddQuery] = useState("");
  const [addSubjectType, setAddSubjectType] = useState<"department" | "account">("department");
  const [newLevel, setNewLevel] = useState<AgentPermissionLevel>("run");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const accessQuery = useQuery({
    queryKey: ["agent-access", props.agent.id],
    queryFn: () => agentsApi.access(props.agent.id)
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: departmentsApi.list
  });

  const usersQuery = useQuery({
    queryKey: ["users", "responsible-candidates"],
    queryFn: () => usersApi.listResponsibleCandidates()
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
    if (!accessQuery.data) return;
    setDepartmentGrants(
      accessQuery.data.department_grants.map((grant) => ({
        localId: grant.id,
        department_id: grant.department_id,
        label: departmentsById.get(grant.department_id) ?? grant.department_id,
        level: flagsToLevel(grant)
      }))
    );
    setUserGrants(
      accessQuery.data.user_grants.map((grant) => ({
        localId: grant.id,
        user_id: grant.user_id,
        label: formatShortPersonName(usersById.get(grant.user_id)?.full_name),
        level: flagsToLevel(grant)
      }))
    );
  }, [accessQuery.data, departmentsById, usersById]);

  const departmentGrantIds = useMemo(
    () => new Set(departmentGrants.map((grant) => grant.department_id)),
    [departmentGrants]
  );

  const userGrantIds = useMemo(() => new Set(userGrants.map((grant) => grant.user_id)), [userGrants]);

  const inheritedAccounts = useMemo(() => {
    return (usersQuery.data ?? [])
      .filter((user) => user.department_id && departmentGrantIds.has(user.department_id) && !userGrantIds.has(user.id))
      .map((user) => {
        const departmentGrant = departmentGrants.find((grant) => grant.department_id === user.department_id);
        return {
          user,
          departmentName: departmentsById.get(user.department_id!) ?? user.department_name ?? "—",
          level: departmentGrant?.level ?? ("run" as AgentPermissionLevel)
        };
      })
      .sort((left, right) =>
        formatShortPersonName(left.user.full_name).localeCompare(formatShortPersonName(right.user.full_name), "ru")
      );
  }, [usersQuery.data, departmentGrantIds, userGrantIds, departmentGrants, departmentsById]);

  const departmentCandidates = useMemo(() => {
    const query = addQuery.trim().toLowerCase();
    return (departmentsQuery.data ?? [])
      .filter((department) => !departmentGrantIds.has(department.id))
      .filter((department) => !query || department.name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [departmentsQuery.data, departmentGrantIds, addQuery]);

  const accountCandidates = useMemo(() => {
    const query = addQuery.trim().toLowerCase();
    return (usersQuery.data ?? [])
      .filter((user) => !userGrantIds.has(user.id))
      .filter((user) => {
        if (!query) return true;
        const haystack = [user.full_name, user.position, user.department_name].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 6);
  }, [usersQuery.data, userGrantIds, addQuery]);

  const candidates = addSubjectType === "department" ? departmentCandidates : accountCandidates;

  const saveMutation = useMutation({
    mutationFn: () =>
      agentsApi.updateAccess(props.agent.id, {
        department_grants: departmentGrants.map(toDepartmentPayload),
        user_grants: userGrants.map(toUserPayload)
      }),
    onSuccess: async () => {
      setSaveError(null);
      await queryClient.invalidateQueries({ queryKey: ["agent-access", props.agent.id] });
      await queryClient.invalidateQueries({ queryKey: ["agents", "available"] });
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
      setSaveError("Не удалось сохранить доступ к агенту.");
    }
  });

  function resetAddForm() {
    setAddQuery("");
    setNewLevel("run");
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

  function addGrant(subjectId: string) {
    if (addSubjectType === "department") {
      const department = departmentsQuery.data?.find((item) => item.id === subjectId);
      if (!department) return;
      setDepartmentGrants((items) => [
        ...items,
        {
          localId: createLocalId(),
          department_id: department.id,
          label: department.name,
          level: newLevel
        }
      ]);
      if (view !== "department") setView("department");
    } else {
      const user = usersQuery.data?.find((item) => item.id === subjectId);
      if (!user) return;
      setUserGrants((items) => [
        ...items,
        {
          localId: createLocalId(),
          user_id: user.id,
          label: formatShortPersonName(user.full_name),
          level: newLevel
        }
      ]);
      if (view !== "account") setView("account");
    }
    closeAddPanel();
  }

  const isLoading = accessQuery.isLoading || departmentsQuery.isLoading || usersQuery.isLoading;
  const levelOptions = props.compact ? compactPermissionLevelOptions : permissionLevelOptions;
  const subjectTypeOptions = props.compact ? compactAddSubjectTypeOptions : addSubjectTypeOptions;
  const tabIconSize = props.compact ? 13 : 14;

  const editorBody = isLoading ? (
    <p className={styles.agentAccessEmpty}>Загрузка…</p>
  ) : (
    <>
          <div className={styles.agentAccessSectionHead}>
            <span>{view === "department" ? "Подразделения" : "Учётные записи"}</span>
            <button
              type="button"
              className={`${styles.agentAccessAddButton} ${isAddOpen ? styles.agentAccessAddButtonActive : ""}`}
              onClick={() => (isAddOpen ? closeAddPanel() : openAddPanel())}
              aria-expanded={isAddOpen}
              title="Добавить"
            >
              <Plus size={14} strokeWidth={2.4} />
            </button>
          </div>

          {isAddOpen ? (
            <div className={styles.agentAccessAddPanel}>
              <div className={styles.agentAccessSearchCombo}>
                <FormSelect
                  compact
                  className={props.compact ? styles.agentAccessListSelect : undefined}
                  value={addSubjectType}
                  onChange={(value) => {
                    setAddSubjectType(value as "department" | "account");
                    setAddQuery("");
                  }}
                  options={subjectTypeOptions}
                  ariaLabel="Тип субъекта"
                />
                <FormSearchInput
                  compact
                  value={addQuery}
                  onChange={setAddQuery}
                  placeholder={
                    addSubjectType === "department" ? "Название подразделения" : "ФИО, должность или отдел"
                  }
                />
              </div>
              <FormSelect
                compact
                className={props.compact ? styles.agentAccessListSelect : undefined}
                value={newLevel}
                onChange={(value) => setNewLevel(value as AgentPermissionLevel)}
                options={levelOptions}
                ariaLabel="Уровень доступа"
              />
              {candidates.length > 0 ? (
                <div className={styles.agentAccessCandidates}>
                  {candidates.map((item) => {
                    const label =
                      addSubjectType === "department"
                        ? "name" in item
                          ? item.name
                          : item.id
                        : formatShortPersonName("full_name" in item ? item.full_name : null);
                    const meta =
                      addSubjectType === "account" && "position" in item
                        ? [item.position, item.department_name].filter(Boolean).join(" · ")
                        : null;
                    return (
                      <button key={item.id} type="button" className={styles.agentAccessCandidate} onClick={() => addGrant(item.id)}>
                        <strong>{label}</strong>
                        {meta ? <span>{meta}</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : addQuery.trim() ? (
                <p className={styles.agentAccessEmpty}>Ничего не найдено.</p>
              ) : null}
            </div>
          ) : null}

          {view === "department" ? (
            !departmentGrants.length && !isAddOpen ? (
              <p className={styles.agentAccessEmpty}>Подразделения не назначены.</p>
            ) : (
              <ul className={styles.agentAccessList}>
                {departmentGrants.map((grant) => (
                  <li key={grant.localId} className={styles.agentAccessListItem}>
                    <span className={styles.agentAccessListLabel}>{grant.label}</span>
                    <FormSelect
                      compact
                      className={props.compact ? styles.agentAccessListSelect : undefined}
                      value={grant.level}
                      onChange={(value) =>
                        setDepartmentGrants((items) =>
                          items.map((item) =>
                            item.localId === grant.localId ? { ...item, level: value as AgentPermissionLevel } : item
                          )
                        )
                      }
                      options={levelOptions}
                      ariaLabel="Уровень доступа"
                    />
                    <button
                      type="button"
                      className={styles.agentAccessRemove}
                      onClick={() => setDepartmentGrants((items) => items.filter((item) => item.localId !== grant.localId))}
                      title="Удалить"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : !userGrants.length && !isAddOpen ? (
            <p className={styles.agentAccessEmpty}>Прямой доступ не настроен.</p>
          ) : (
            <ul className={styles.agentAccessList}>
              {userGrants.map((grant) => (
                <li key={grant.localId} className={styles.agentAccessListItem}>
                  <div className={styles.agentAccessListLabelWrap}>
                    <span className={styles.agentAccessListLabel}>{grant.label}</span>
                    <small>{usersById.get(grant.user_id)?.position?.trim() || "—"}</small>
                  </div>
                  <FormSelect
                    compact
                    className={props.compact ? styles.agentAccessListSelect : undefined}
                    value={grant.level}
                    onChange={(value) =>
                      setUserGrants((items) =>
                        items.map((item) =>
                          item.localId === grant.localId ? { ...item, level: value as AgentPermissionLevel } : item
                        )
                      )
                    }
                    options={levelOptions}
                    ariaLabel="Уровень доступа"
                  />
                  <button
                    type="button"
                    className={styles.agentAccessRemove}
                    onClick={() => setUserGrants((items) => items.filter((item) => item.localId !== grant.localId))}
                    title="Удалить"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {view === "account" && inheritedAccounts.length > 0 ? (
            <div className={styles.agentAccessInherited}>
              <span className={styles.agentAccessInheritedTitle}>Через подразделение</span>
              {inheritedAccounts.map(({ user, departmentName, level }) => (
                <div key={user.id} className={styles.agentAccessInheritedItem}>
                  <span>{formatShortPersonName(user.full_name)}</span>
                  <small>
                    {departmentName} · {levelOptions.find((item) => item.value === level)?.label}
                  </small>
                </div>
              ))}
            </div>
          ) : null}
    </>
  );

  return (
    <div className={`${styles.agentAccessEditor} ${props.compact ? styles.agentAccessEditorCompact : ""}`}>
      <div className={styles.agentAccessEditorTabs} role="tablist" aria-label="Тип доступа">
        <button
          type="button"
          role="tab"
          aria-selected={view === "department"}
          title="Подразделение"
          className={view === "department" ? styles.agentAccessTabActive : styles.agentAccessTab}
          onClick={() => {
            setView("department");
            closeAddPanel();
          }}
        >
          <Building2 size={tabIconSize} strokeWidth={2} aria-hidden="true" />
          <span className={styles.agentAccessTabText}>Подразделение</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "account"}
          title="Учётная запись"
          className={view === "account" ? styles.agentAccessTabActive : styles.agentAccessTab}
          onClick={() => {
            setView("account");
            closeAddPanel();
          }}
        >
          <UserRound size={tabIconSize} strokeWidth={2} aria-hidden="true" />
          <span className={styles.agentAccessTabText}>Должность</span>
        </button>
        <button type="button" className={styles.agentAccessClose} onClick={props.onClose} title="Закрыть">
          <X size={props.compact ? 14 : 15} />
        </button>
      </div>

      <div className={styles.agentAccessEditorBody}>{editorBody}</div>

      {saveError ? <p className={styles.agentAccessError}>{saveError}</p> : null}

      <div className={styles.agentAccessFooter}>
        <button type="button" className={styles.agentAccessCancel} onClick={props.onClose} disabled={saveMutation.isPending}>
          Отмена
        </button>
        <button
          type="button"
          className={styles.agentAccessSave}
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isLoading}
        >
          {saveMutation.isPending ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
