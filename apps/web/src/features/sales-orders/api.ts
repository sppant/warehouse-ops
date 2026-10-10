import { apiFetch } from "../../lib/api";

export type SalesOrderStatus =
  | "PENDING"
  | "ALLOCATED"
  | "PICKING"
  | "PICKED"
  | "PACKED"
  | "SHIPPED"
  | "CANCELLED";

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customer: string;
  status: SalesOrderStatus;
  createdAt: string;
}

export interface SalesOrderItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  orderedQuantity: number;
  allocatedQuantity: number;
  pickedQuantity: number;
  shippedQuantity: number;
}

export interface SalesOrderDetail extends SalesOrder {
  items: SalesOrderItem[];
}

export interface CreateSalesOrderItem {
  productId: string;
  orderedQuantity: number;
}

export interface CreateSalesOrderInput {
  orderNumber: string;
  customer: string;
  items: CreateSalesOrderItem[];
}

export async function getSalesOrders() {
  const response = await apiFetch<{ data: SalesOrder[] }>(
    "/api/sales-orders",
  );

  return response.data;
}

export async function getSalesOrder(id: string) {
  const response = await apiFetch<{ data: SalesOrderDetail }>(
    `/api/sales-orders/${id}`,
  );

  return response.data;
}

export async function createSalesOrder(input: CreateSalesOrderInput) {
  const response = await apiFetch<{ data: SalesOrderDetail }>(
    "/api/sales-orders",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function allocateSalesOrder(id: string) {
  const response = await apiFetch<{ data: SalesOrder }>(
    `/api/sales-orders/${id}/allocate`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

  return response.data;
}
