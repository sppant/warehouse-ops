import { apiFetch } from "../../lib/api";

export type PickTaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface PickTask {
  id: string;
  salesOrderId: string;
  orderNumber: string;
  customer: string;
  status: PickTaskStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface PickTaskItem {
  id: string;
  salesOrderItemId: string;
  productId: string;
  sku: string;
  productName: string;
  locationId: string;
  locationCode: string;
  quantity: number;
  pickedQuantity: number;
}

export interface PickTaskDetail extends PickTask {
  items: PickTaskItem[];
}

export async function getPickTasks() {
  const response = await apiFetch<{ data: PickTask[] }>("/api/pick-tasks");

  return response.data;
}

export async function getPickTask(id: string) {
  const response = await apiFetch<{ data: PickTaskDetail }>(
    `/api/pick-tasks/${id}`,
  );

  return response.data;
}

export async function generatePickTask(salesOrderId: string) {
  const response = await apiFetch<{ data: PickTask }>("/api/pick-tasks", {
    method: "POST",
    body: JSON.stringify({ salesOrderId }),
  });

  return response.data;
}

export async function pickItem(
  pickTaskItemId: string,
  input: { quantity: number; reason?: string },
) {
  const response = await apiFetch<{
    data: { pickTaskId: string; taskStatus: PickTaskStatus };
  }>(`/api/pick-tasks/items/${pickTaskItemId}/pick`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.data;
}
