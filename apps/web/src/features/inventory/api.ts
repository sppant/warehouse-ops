import { apiFetch } from "../../lib/api";

export type InventoryItem = {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  onHand: number;
  reserved: number;
  damaged: number;
  available: number;
  updatedAt: string;
};

type InventoryResponse = {
  data: InventoryItem[];
};

export function getInventory(search?: string) {
  const params = new URLSearchParams();

  if (search) {
    params.set("search", search);
  }

  const query = params.toString();

  return apiFetch<InventoryResponse>(
    `/api/inventory${query ? `?${query}` : ""}`,
  );
}

export type StockMovementType =
  | "RECEIPT"
  | "PICK"
  | "DAMAGE"
  | "RETURN"
  | "ADJUSTMENT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT";

export type StockMovement = {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  locationId: string;
  locationCode: string;
  type: StockMovementType;
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  createdAt: string;
};

export async function getInventoryMovements() {
  const response = await apiFetch<{ data: StockMovement[] }>(
    "/api/inventory/movements",
  );

  return response.data;
}
