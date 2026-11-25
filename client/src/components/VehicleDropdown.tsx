import type { SelectOption } from '../types/vehicle';

interface VehicleDropdownProps {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  placeholder: string;
  disabled?: boolean;
  isLoading?: boolean;
  onChange: (value: string) => void;
}

export function VehicleDropdown({
  id,
  label,
  value,
  options,
  placeholder,
  disabled = false,
  isLoading = false,
  onChange,
}: VehicleDropdownProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{isLoading ? 'Loading…' : placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
