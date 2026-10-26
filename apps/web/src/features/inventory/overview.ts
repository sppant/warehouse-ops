import { apiFetch } from "../../lib/api";

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export const statusLabels: Record<StockStatus, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
};

export type OverviewSortKey =
  | "product"
  | "sku"
  | "location"
  | "onHand"
  | "available"
  | "status"
  | "lastMovement";

export type SortDirection = "asc" | "desc";

export type OverviewParams = {
  locationId?: string;
  status?: StockStatus;
  search?: string;
  sortBy: OverviewSortKey;
  sortDir: SortDirection;
  page: number;
  pageSize: number;
};

export type OverviewItem = {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  locationId: string;
  locationCode: string;
  warehouseCode: string;
  onHand: number;
  reserved: number;
  damaged: number;
  available: number;
  status: StockStatus;
  lastMovementAt: string | null;
  cycleCountFlaggedAt: string | null;
};

export type OverviewResponse = {
  data: OverviewItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type InventorySummary = {
  stockByLocation: Array<{
    locationId: string;
    locationCode: string;
    warehouseCode: string;
    onHand: number;
    available: number;
  }>;
  movementsPerDay: Array<{ date: string; count: number; volume: number }>;
  topItems: Array<{
    productId: string;
    sku: string;
    productName: string;
    movementCount: number;
    volume: number;
  }>;
};

// Query keys include every input that changes the result, so each filter,
// sort and page combination is cached separately. Everything lives under
// ["inventory"], which is what other pages (e.g. Receiving) invalidate after
// they change stock.
export const inventoryKeys = {
  all: ["inventory"] as const,
  overviewAll: ["inventory", "overview"] as const,
  overview: (params: OverviewParams) =>
    ["inventory", "overview", params] as const,
  summary: ["inventory", "summary"] as const,
};

export function getInventoryOverview(
  params: OverviewParams,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    page: String(params.page),
    pageSize: String(params.pageSize),
  });

  if (params.locationId) query.set("locationId", params.locationId);
  if (params.status) query.set("status", params.status);
  if (params.search) query.set("search", params.search);

  return apiFetch<OverviewResponse>(`/api/inventory/overview?${query}`, {
    signal,
  });
}

export async function getInventorySummary(signal?: AbortSignal) {
  const response = await apiFetch<{ data: InventorySummary }>(
    "/api/inventory/summary",
    { signal },
  );

  return response.data;
}

export async function setCycleCountFlag(id: string, flagged: boolean) {
  const response = await apiFetch<{
    data: { id: string; cycleCountFlaggedAt: string | null };
  }>(`/api/inventory/${id}/cycle-count-flag`, {
    method: "PUT",
    body: JSON.stringify({ flagged }),
  });

  return response.data;
}
