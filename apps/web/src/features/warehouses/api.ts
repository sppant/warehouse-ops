import { apiFetch } from "../../lib/api";

export type Warehouse = {
  id: string;
  code: string;
  name: string;
  createdAt: string;
};

export type Location = {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  createdAt: string;
};

export type CreateLocationInput = {
  code: string;
  name: string;
};

type WarehousesResponse = {
  data: Warehouse[];
};

type LocationsResponse = {
  data: Location[];
};

type LocationResponse = {
  data: Location;
};

export function getWarehouses() {
  return apiFetch<WarehousesResponse>("/api/warehouses");
}

export function getLocations(warehouseId: string) {
  return apiFetch<LocationsResponse>(
    `/api/warehouses/${warehouseId}/locations`,
  );
}

export function createLocation(
  warehouseId: string,
  input: CreateLocationInput,
) {
  return apiFetch<LocationResponse>(
    `/api/warehouses/${warehouseId}/locations`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
