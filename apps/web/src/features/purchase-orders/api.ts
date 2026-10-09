import { apiFetch } from "../../lib/api";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "ORDERED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplier: string;
  status: PurchaseOrderStatus;
  orderedAt: string | null;
  expectedAt: string | null;
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: string;
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  items: PurchaseOrderItem[];
}

export interface CreatePurchaseOrderItem {
  productId: string;
  orderedQuantity: number;
  unitCost: number;
}

export interface CreatePurchaseOrderInput {
  orderNumber: string;
  supplier: string;
  expectedAt?: string;
  items: CreatePurchaseOrderItem[];
}



export interface ReceivePurchaseOrderItemInput {
  locationId: string;
  quantity: number;
  reason?: string;
}

export interface ReceivePurchaseOrderItemResult {
  purchaseOrderId: string;
  purchaseOrderItemId: string;
  productId: string;
  locationId: string;
  quantity: number;
  status: PurchaseOrderStatus;
}

export async function receivePurchaseOrderItem(
  itemId: string,
  input: ReceivePurchaseOrderItemInput,
) {
  const response = await apiFetch<{ data: ReceivePurchaseOrderItemResult }>(
    `/api/purchase-orders/items/${itemId}/receive`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return response.data;
}

export async function getPurchaseOrders() {
  const response = await apiFetch<{ data: PurchaseOrder[] }>(
    "/api/purchase-orders",
  );

  return response.data;
}

export async function getPurchaseOrder(id: string) {
  const response = await apiFetch<{ data: PurchaseOrderDetail }>(
    `/api/purchase-orders/${id}`,
  );

  return response.data;
}

export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
) {
  const response = await apiFetch<{ data: PurchaseOrderDetail }>(
    "/api/purchase-orders",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: PurchaseOrderStatus,
) {
  const response = await apiFetch<{ data: PurchaseOrder }>(
    `/api/purchase-orders/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );

  return response.data;
}
