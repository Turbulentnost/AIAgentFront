import FormAutocomplete from "@/components/form-controls/FormAutocomplete";
import type { Position } from "@/types";

export default function PositionSelect({
  value,
  onChange,
  positions,
  placeholder = "Выберите должность",
  allowEmpty = true,
  emptyLabel = "Без должности",
  className,
  compact = false,
  ariaLabel = "Должность",
  loading = false
}: {
  value: string;
  onChange: (value: string) => void;
  positions: Position[];
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  compact?: boolean;
  ariaLabel?: string;
  loading?: boolean;
}) {
  const options = positions.map((position) => ({
    value: position.name,
    label: position.name
  }));

  return (
    <FormAutocomplete
      className={className}
      compact={compact}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={loading ? "Загружаем должности..." : placeholder}
      ariaLabel={ariaLabel}
      emptyValue={allowEmpty ? "" : undefined}
      emptyLabel={emptyLabel}
      noResultsText="Должность не найдена"
    />
  );
}
