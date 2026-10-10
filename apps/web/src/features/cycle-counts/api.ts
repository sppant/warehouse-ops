import { apiFetch } from "../../lib/api";

export type CycleCountStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface CycleCount {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  locationId: string;
  locationCode: string;
  expectedQuantity: number;
  countedQuantity: number;
  difference: number;
  reason: string | null;
  status: CycleCountStatus;
  createdAt: string;
  reviewedAt: string | null;
}

export interface RecordCycleCountInput {
  productId: string;
  locationId: string;
  countedQuantity: number;
  reason?: string;
}

export async function getCycleCounts() {
  const response = await apiFetch<{ data: CycleCount[] }>(
    "/api/cycle-counts",
  );

  return response.data;
}

export async function recordCycleCount(input: RecordCycleCountInput) {
  const response = await apiFetch<{ data: CycleCount }>(
    "/api/cycle-counts",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function approveCycleCount(id: string) {
  const response = await apiFetch<{ data: CycleCount }>(
    `/api/cycle-counts/${id}/approve`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

  return response.data;
}

export async function rejectCycleCount(id: string) {
  const response = await apiFetch<{ data: CycleCount }>(
    `/api/cycle-counts/${id}/reject`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

  return response.data;
}
