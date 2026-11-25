/** make id -> model name -> list of badges */
export type VehicleCatalogue = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;

export interface MakeOption {
  value: string;
  label: string;
}

export interface VehicleSelection {
  make: string;
  model: string;
  badge: string;
}
