import type { QuickSelectVehicle, VehicleSelection } from '../types/vehicle';

interface QuickSelectButtonsProps {
  vehicles: readonly QuickSelectVehicle[];
  selection: VehicleSelection;
  disabled?: boolean;
  onSelect: (vehicle: VehicleSelection) => void;
}

const isSameVehicle = (a: VehicleSelection, b: VehicleSelection) =>
  a.make === b.make && a.model === b.model && a.badge === b.badge;

export function QuickSelectButtons({ vehicles, selection, disabled = false, onSelect }: QuickSelectButtonsProps) {
  return (
    <div className="quick-select" role="group" aria-labelledby="quick-select-heading">
      <h2 id="quick-select-heading" className="section-label">
        Quick select
      </h2>
      <div className="quick-select__buttons">
        {vehicles.map((vehicle) => (
          <button
            key={vehicle.label}
            type="button"
            className="button button--secondary"
            aria-pressed={isSameVehicle(vehicle, selection)}
            disabled={disabled}
            onClick={() => onSelect(vehicle)}
          >
            {vehicle.label}
          </button>
        ))}
      </div>
    </div>
  );
}
