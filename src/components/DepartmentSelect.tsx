import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { departmentsApi } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthContext";
import FormAutocomplete from "@/components/form-controls/FormAutocomplete";
import type { Department } from "@/types";

const SYNC_VALUE = "__sync_departments_from_1c__";

export default function DepartmentSelect({
  value,
  onChange,
  departments,
  placeholder = "Выберите подразделение",
  allowEmpty = true,
  emptyLabel = "Без подразделения",
  allValue,
  allLabel = "Все подразделения",
  className,
  compact = false,
  ariaLabel = "Подразделение"
}: {
  value: string;
  onChange: (value: string) => void;
  departments: Department[];
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  allValue?: string;
  allLabel?: string;
  className?: string;
  compact?: boolean;
  ariaLabel?: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const syncStatus = useQuery({ queryKey: ["departments", "sync-status"], queryFn: departmentsApi.syncStatus });
  const syncMutation = useMutation({
    mutationFn: departmentsApi.syncFrom1C,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
    }
  });
  const nextAllowedAt = syncStatus.data?.next_allowed_at ? new Date(syncStatus.data.next_allowed_at) : null;
  const canSync = Boolean(user?.is_superuser) && (!nextAllowedAt || nextAllowedAt <= new Date());
  const syncLabel = buildSyncLabel(syncStatus.data?.last_synced_at, syncStatus.data?.next_allowed_at, user?.is_superuser);

  const options = [
    ...(allValue !== undefined ? [{ value: allValue, label: allLabel }] : []),
    ...departments.map((department) => ({ value: department.id, label: department.name }))
  ];

  return (
    <FormAutocomplete
      className={className}
      compact={compact}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      emptyValue={allowEmpty ? "" : undefined}
      emptyLabel={emptyLabel}
      footerOptions={[
        {
          value: SYNC_VALUE,
          label: syncMutation.isPending ? "Обновляем подразделения из 1С..." : syncLabel,
          disabled: !canSync || syncMutation.isPending
        }
      ]}
      onFooterSelect={(nextValue) => {
        if (nextValue === SYNC_VALUE && canSync && !syncMutation.isPending) {
          syncMutation.mutate();
        }
      }}
    />
  );
}

function buildSyncLabel(lastSyncedAt?: string | null, nextAllowedAt?: string | null, isSuperuser?: boolean) {
  if (!isSuperuser) return "Обновить базу подразделений из 1С (только администратор)";
  const next = nextAllowedAt ? new Date(nextAllowedAt) : null;
  if (nextAllowedAt && next && next > new Date()) {
    return `Обновить базу подразделений из 1С (доступно ${formatDate(nextAllowedAt)})`;
  }
  if (lastSyncedAt) return `Обновить базу подразделений из 1С (последнее ${formatDate(lastSyncedAt)})`;
  return "Обновить базу подразделений из 1С";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
