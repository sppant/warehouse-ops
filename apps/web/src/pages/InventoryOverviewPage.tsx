import { useState } from "react";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { InventoryCharts } from "../features/inventory/InventoryCharts";
import { InventoryFilters } from "../features/inventory/InventoryFilters";
import { InventoryTable } from "../features/inventory/InventoryTable";
import type {
  OverviewItem,
  OverviewSortKey,
  SortDirection,
  StockStatus,
} from "../features/inventory/overview";
import {
  useAllLocations,
  useCycleCountFlag,
  useInventoryOverview,
  useInventorySummary,
} from "../features/inventory/queries";
import { useDebouncedValue } from "../lib/useDebouncedValue";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

// Columns where the most interesting rows are the biggest/newest ones.
const descendingFirst: ReadonlySet<OverviewSortKey> = new Set([
  "onHand",
  "available",
  "lastMovement",
]);

export function InventoryOverviewPage() {
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState<StockStatus | "">("");
  const [sortBy, setSortBy] = useState<OverviewSortKey>("product");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  // The page number is remembered together with the search it was chosen for,
  // so a new (debounced) search falls back to page 1 without an effect.
  const [pageState, setPageState] = useState({ page: 1, forSearch: "" });

  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const page = pageState.forSearch === debouncedSearch ? pageState.page : 1;
  const goToPage = (next: number) =>
    setPageState({ page: next, forSearch: debouncedSearch });

  const overview = useInventoryOverview({
    locationId: locationId || undefined,
    status: status || undefined,
    search: debouncedSearch || undefined,
    sortBy,
    sortDir,
    page,
    pageSize: PAGE_SIZE,
  });
  const summary = useInventorySummary();
  const locations = useAllLocations();
  const flag = useCycleCountFlag();

  const meta = overview.data?.meta;

  // If the data shrank underneath us (rows removed elsewhere), step back to
  // the last page that still exists.
  if (meta && !overview.isPlaceholderData && page > meta.totalPages) {
    goToPage(meta.totalPages);
  }

  const resetPage = () => goToPage(1);

  const handleSort = (key: OverviewSortKey) => {
    if (key === sortBy) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir(descendingFirst.has(key) ? "desc" : "asc");
    }
    resetPage();
  };

  const handleToggleFlag = (item: OverviewItem) =>
    flag.mutate({ id: item.id, flagged: !item.cycleCountFlaggedAt });

  const clearFilters = () => {
    setSearch("");
    setLocationId("");
    setStatus("");
    setPageState({ page: 1, forSearch: "" });
  };

  const hasData = overview.data !== undefined;
  const statusMessage = flag.isError
    ? { text: "Couldn't update the flag, so the change was reverted.", error: true }
    : overview.isError && hasData
      ? { text: "Couldn't refresh. Showing the last loaded data.", error: true }
      : overview.isFetching && !overview.isPlaceholderData && hasData
        ? { text: "Refreshing…", error: false }
        : null;

  return (
    <div className="page">
      <PageHeader
        title="Inventory Overview"
        description="Stock levels, status and recent activity across all locations."
      />

      <InventoryCharts
        summary={summary.data}
        isLoading={summary.isPending}
        isError={summary.isError}
        onRetry={() => void summary.refetch()}
      />

      <Card>
        <InventoryFilters
          locations={locations.data ?? []}
          locationId={locationId}
          status={status}
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
          }}
          onLocationChange={(value) => {
            setLocationId(value);
            resetPage();
          }}
          onStatusChange={(value) => {
            setStatus(value);
            resetPage();
          }}
          onClear={clearFilters}
        />

        {/* Reserved line: messages appear here without moving the table. */}
        <div
          className={`inv-status-line${statusMessage?.error ? " inv-status-error" : ""}`}
          role="status"
        >
          {statusMessage?.text}
        </div>

        <InventoryTable
          items={overview.data?.data ?? []}
          pageSize={PAGE_SIZE}
          page={page}
          totalPages={meta?.totalPages ?? 1}
          total={meta?.total ?? 0}
          sortBy={sortBy}
          sortDir={sortDir}
          isLoading={overview.isPending}
          isRefreshing={overview.isPlaceholderData}
          isError={overview.isError}
          hasActiveFilters={Boolean(locationId || status || debouncedSearch)}
          pendingFlagId={flag.isPending ? flag.variables?.id : undefined}
          onRetry={() => void overview.refetch()}
          onSortChange={handleSort}
          onPageChange={goToPage}
          onToggleFlag={handleToggleFlag}
        />
      </Card>
    </div>
  );
}
