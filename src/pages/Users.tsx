import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { departmentsApi, positionsApi, usersApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
import DepartmentSelect from "@/components/DepartmentSelect";
import PositionSelect from "@/components/PositionSelect";
import { FormSearchInput } from "@/components/form-controls";
import formStyles from "@/components/form-controls/form-controls.module.css";
import type { Department, User, UserCreate } from "@/types";
import styles from "./Users.module.css";

const emptyForm: UserCreate = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  middle_name: "",
  position: "",
  phone: "",
  department_id: null
};

function getUserDisplayName(user: User) {
  return (
    user.full_name?.trim() ||
    [user.last_name, user.first_name, user.middle_name].filter(Boolean).join(" ") ||
    user.email
  );
}

function getDepartmentName(departments: Department[], departmentId: string | null | undefined) {
  if (!departmentId) return "Без подразделения";
  return departments.find((department) => department.id === departmentId)?.name ?? "Без подразделения";
}

function matchesUserSearch(user: User, query: string, departments: Department[]) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const departmentName = getDepartmentName(departments, user.department_id);
  const haystack = [
    user.full_name,
    user.email,
    user.username,
    user.first_name,
    user.last_name,
    user.middle_name,
    user.position,
    user.phone,
    departmentName
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

function getDeleteErrorMessage(error: unknown) {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return "Не удалось удалить пользователя.";
}

export default function Users() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UserCreate>(emptyForm);
  const [search, setSearch] = useState("");

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
    enabled: Boolean(user?.is_superuser)
  });
  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: departmentsApi.list });
  const positionsQuery = useQuery({
    queryKey: ["positions"],
    queryFn: positionsApi.list,
    enabled: Boolean(user?.is_superuser)
  });

  const departments = departmentsQuery.data ?? [];
  const positions = positionsQuery.data ?? [];
  const filteredUsers = useMemo(
    () => (usersQuery.data ?? []).filter((item) => matchesUserSearch(item, search, departments)),
    [departments, search, usersQuery.data]
  );

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: async () => {
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: usersApi.deactivate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      window.alert(getDeleteErrorMessage(error));
    }
  });

  if (!user?.is_superuser) {
    return <div className="card">Раздел доступен только суперпользователю.</div>;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate({
      ...form,
      department_id: form.department_id || null
    });
  }

  function handleDelete(item: User) {
    const displayName = getUserDisplayName(item);
    const confirmed = window.confirm(
      `Удалить пользователя «${displayName}»?\n\nПользователь потеряет доступ и исчезнет из списка.`
    );
    if (confirmed) deleteMutation.mutate(item.id);
  }

  const totalCount = usersQuery.data?.length ?? 0;
  const visibleCount = filteredUsers.length;

  return (
    <section className={styles.page} aria-labelledby="users-title">
      <header className={styles.header}>
        <h1 id="users-title">Пользователи</h1>
        <p>Управление учётными записями сотрудников и быстрый поиск по списку.</p>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebarCard} aria-label="Создание пользователя">
          <div className={styles.sidebarInner}>
            <h2>Создать пользователя</h2>
            <form className={styles.createForm} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                Email <span className={styles.required}>*</span>
              </span>
              <input
                className={`${formStyles.control} ${styles.compactControl}`}
                placeholder="name@company.com"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                Пароль <span className={styles.required}>*</span>
              </span>
              <input
                className={`${formStyles.control} ${styles.compactControl}`}
                placeholder="Минимум 8 символов"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                minLength={8}
                required
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Фамилия</span>
              <input
                className={`${formStyles.control} ${styles.compactControl}`}
                placeholder="Иванов"
                value={form.last_name}
                onChange={(event) => setForm({ ...form, last_name: event.target.value })}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Имя</span>
              <input
                className={`${formStyles.control} ${styles.compactControl}`}
                placeholder="Иван"
                value={form.first_name}
                onChange={(event) => setForm({ ...form, first_name: event.target.value })}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Отчество</span>
              <input
                className={`${formStyles.control} ${styles.compactControl}`}
                placeholder="Иванович"
                value={form.middle_name}
                onChange={(event) => setForm({ ...form, middle_name: event.target.value })}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Должность</span>
              <PositionSelect
                value={form.position || ""}
                onChange={(value) => setForm({ ...form, position: value || undefined })}
                positions={positions}
                loading={positionsQuery.isLoading}
                placeholder="Выберите должность"
                ariaLabel="Должность"
                compact
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Телефон</span>
              <input
                className={`${formStyles.control} ${styles.compactControl}`}
                placeholder="+7 (999) 000-00-00"
                type="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Подразделение</span>
              <DepartmentSelect
                value={form.department_id || ""}
                onChange={(value) => setForm({ ...form, department_id: value || null })}
                departments={departments}
                placeholder="Без подразделения"
                ariaLabel="Подразделение"
                compact
              />
            </label>

            <button className={styles.submitButton} type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Создаём..." : "Создать пользователя"}
            </button>
          </form>
          </div>
        </aside>

        <div className={styles.mainCard}>
          <div className={styles.listHead}>
            <div>
              <h2>Список пользователей</h2>
              <p className={styles.listMeta}>
                {search.trim()
                  ? `Найдено: ${visibleCount} из ${totalCount}`
                  : `Всего пользователей: ${totalCount}`}
              </p>
            </div>
            <div className={styles.searchWrap}>
              <FormSearchInput
                value={search}
                onChange={setSearch}
                placeholder="Поиск по ФИО, email, должности, телефону..."
              />
            </div>
          </div>

          <div className={styles.mainCardBody}>
          {usersQuery.isError ? <p className={styles.error}>Не удалось загрузить пользователей.</p> : null}

          {!usersQuery.data?.length ? (
            <p className={styles.emptyState}>Пользователей пока нет.</p>
          ) : !filteredUsers.length ? (
            <p className={styles.emptyState}>По запросу «{search.trim()}» ничего не найдено.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <colgroup>
                  <col className={styles.colUser} />
                  <col className={styles.colDepartment} />
                  <col className={styles.colStatus} />
                  <col className={styles.colActions} />
                </colgroup>
                <thead className={styles.tableHead}>
                  <tr>
                    <th>Пользователь</th>
                    <th>Подразделение</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
              </table>
              <div className={styles.tableBodyScroll}>
                <table className={styles.table}>
                  <colgroup>
                    <col className={styles.colUser} />
                    <col className={styles.colDepartment} />
                    <col className={styles.colStatus} />
                    <col className={styles.colActions} />
                  </colgroup>
                  <tbody>
                    {filteredUsers.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span className={styles.userName}>{getUserDisplayName(item)}</span>
                          <small className={styles.userMeta}>{item.position || item.email}</small>
                        </td>
                        <td>{getDepartmentName(departments, item.department_id)}</td>
                        <td>
                          <span className={item.is_active ? styles.statusActive : styles.statusInactive}>
                            {item.is_active ? "Активен" : "Заблокирован"}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actions}>
                            <button
                              className={styles.deactivateButton}
                              type="button"
                              onClick={() => deactivateMutation.mutate(item.id)}
                              disabled={!item.is_active || deactivateMutation.isPending || deleteMutation.isPending}
                            >
                              Заблокировать
                            </button>
                            <button
                              className={styles.deleteButton}
                              type="button"
                              onClick={() => handleDelete(item)}
                              disabled={item.id === user.id || deleteMutation.isPending}
                              title={item.id === user.id ? "Нельзя удалить собственную учётную запись" : undefined}
                            >
                              {deleteMutation.isPending && deleteMutation.variables === item.id
                                ? "Удаляем..."
                                : "Удалить"}
                            </button>
                          </div>
                        </td>
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
