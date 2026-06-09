import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { departmentsApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
import { FormSearchInput } from "@/components/form-controls";
import formStyles from "@/components/form-controls/form-controls.module.css";
import type { Department, DepartmentCreate } from "@/types";
import styles from "./Departments.module.css";

const emptyForm: DepartmentCreate = {
  name: "",
  slug: "",
  description: ""
};

function matchesDepartmentSearch(department: Department, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [department.name, department.slug, department.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

function canSync(nextAllowedAt?: string | null) {
  return !nextAllowedAt || new Date(nextAllowedAt) <= new Date();
}

export default function Departments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DepartmentCreate>(emptyForm);
  const [search, setSearch] = useState("");

  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: departmentsApi.list });
  const syncStatusQuery = useQuery({
    queryKey: ["departments", "sync-status"],
    queryFn: departmentsApi.syncStatus,
    enabled: Boolean(user?.is_superuser)
  });

  const departments = departmentsQuery.data ?? [];
  const filteredDepartments = useMemo(
    () => departments.filter((item) => matchesDepartmentSearch(item, search)),
    [departments, search]
  );

  const createMutation = useMutation({
    mutationFn: departmentsApi.create,
    onSuccess: async () => {
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
    }
  });

  const syncMutation = useMutation({
    mutationFn: departmentsApi.syncFrom1C,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
    }
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate({ ...form, is_active: true });
  }

  const totalCount = departments.length;
  const visibleCount = filteredDepartments.length;
  const syncAllowed = canSync(syncStatusQuery.data?.next_allowed_at);

  return (
    <section className={styles.page} aria-labelledby="departments-title">
      <header className={styles.header}>
        <h1 id="departments-title">Подразделения</h1>
        <p>Структура организации, поиск по названию и синхронизация с 1С.</p>
      </header>

      <div className={`${styles.layout} ${!user?.is_superuser ? styles.layoutFull : ""}`.trim()}>
        {user?.is_superuser ? (
          <aside className={styles.sidebarCard} aria-label="Создание подразделения">
            <div className={styles.sidebarInner}>
              <h2>Создать подразделение</h2>
              <form className={styles.createForm} onSubmit={handleSubmit}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    Название <span className={styles.required}>*</span>
                  </span>
                  <input
                    className={`${formStyles.control} ${styles.compactControl}`}
                    placeholder="Конструкторское бюро"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    Код / slug <span className={styles.required}>*</span>
                  </span>
                  <input
                    className={`${formStyles.control} ${styles.compactControl}`}
                    placeholder="kb"
                    value={form.slug}
                    onChange={(event) => setForm({ ...form, slug: event.target.value })}
                    required
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Описание</span>
                  <textarea
                    className={`${formStyles.control} ${styles.compactTextarea}`}
                    placeholder="Краткое описание подразделения"
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                  />
                </label>

                <button className={styles.submitButton} type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Создаём..." : "Создать подразделение"}
                </button>
              </form>
            </div>
          </aside>
        ) : null}

        <div className={`${styles.mainCard} ${!user?.is_superuser ? styles.mainCardFull : ""}`.trim()}>
          <div className={styles.listHead}>
            <div>
              <h2>Список подразделений</h2>
              <p className={styles.listMeta}>
                {search.trim()
                  ? `Найдено: ${visibleCount} из ${totalCount}`
                  : `Всего подразделений: ${totalCount}`}
              </p>
            </div>
            <div className={styles.listHeadActions}>
              <div className={styles.searchWrap}>
                <FormSearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Поиск по названию, коду или описанию..."
                />
              </div>
              {user?.is_superuser ? (
                <button
                  className={styles.syncButton}
                  type="button"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending || !syncAllowed}
                >
                  {syncMutation.isPending ? "Обновляем..." : "Обновить из 1С"}
                </button>
              ) : null}
            </div>
          </div>

          <div className={styles.mainCardBody}>
            {user?.is_superuser ? (
              <p className={styles.syncMeta}>
                Последнее обновление из 1С:{" "}
                {syncStatusQuery.data?.last_synced_at
                  ? new Date(syncStatusQuery.data.last_synced_at).toLocaleString("ru-RU")
                  : "не выполнялось"}
              </p>
            ) : null}

            {departmentsQuery.isError ? <p className={styles.error}>Не удалось загрузить подразделения.</p> : null}

            {!departments.length ? (
              <p className={styles.emptyState}>Подразделения ещё не созданы.</p>
            ) : !filteredDepartments.length ? (
              <p className={styles.emptyState}>По запросу «{search.trim()}» ничего не найдено.</p>
            ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <colgroup>
                  <col className={styles.colDepartment} />
                  <col className={styles.colStatus} />
                  <col className={styles.colDescription} />
                </colgroup>
                <thead className={styles.tableHead}>
                  <tr>
                    <th>Подразделение</th>
                    <th>Статус</th>
                    <th>Описание</th>
                  </tr>
                </thead>
              </table>
              <div className={styles.tableBodyScroll}>
                <table className={styles.table}>
                  <colgroup>
                    <col className={styles.colDepartment} />
                    <col className={styles.colStatus} />
                    <col className={styles.colDescription} />
                  </colgroup>
                  <tbody>
                    {filteredDepartments.map((department) => (
                      <tr key={department.id}>
                        <td>
                          <span className={styles.departmentName}>{department.name}</span>
                          <small className={styles.departmentMeta}>{department.slug}</small>
                        </td>
                        <td>
                          <span className={department.is_active ? styles.statusActive : styles.statusInactive}>
                            {department.is_active ? "Активно" : "Отключено"}
                          </span>
                        </td>
                        <td className={styles.descriptionCell}>{department.description || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
