import { apiFetch } from "../../lib/api";

export type ReceiveStockInput = {
  productId: string;
  locationId: string;
  quantity: number;
  reason?: string;
};

type ReceiveStockResponse = {
  data: {
    id: string;
    productId: string;
    locationId: string;
    onHand: number;
    reserved: number;
    damaged: number;
    updatedAt: string;
  };
};

export function receiveStock(input: ReceiveStockInput) {
  return apiFetch<ReceiveStockResponse>("/api/inventory/receive", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
