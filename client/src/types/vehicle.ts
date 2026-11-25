export interface MakeOption {
  value: string;
  label: string;
}

export interface VehicleSelection {
  make: string;
  model: string;
  badge: string;
}

export interface QuickSelectVehicle extends VehicleSelection {
  label: string;
}

/** Generic shape used by the dropdown component. */
export interface SelectOption {
  value: string;
  label: string;
}
