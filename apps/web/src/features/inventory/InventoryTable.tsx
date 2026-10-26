import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  statusLabels,
  type OverviewItem,
  type OverviewSortKey,
  type SortDirection,
  type StockStatus,
} from "./overview";

const statusVariant = {
  IN_STOCK: "success",
  LOW_STOCK: "warning",
  OUT_OF_STOCK: "danger",
} as const satisfies Record<StockStatus, "success" | "warning" | "danger">;

const columns: Array<{
  key: OverviewSortKey;
  label: string;
  numeric?: boolean;
}> = [
  { key: "product", label: "Product" },
  { key: "sku", label: "SKU" },
  { key: "location", label: "Location" },
  { key: "onHand", label: "On hand", numeric: true },
  { key: "available", label: "Available", numeric: true },
  { key: "status", label: "Status" },
  { key: "lastMovement", label: "Last movement" },
];

const dateFormat = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

type InventoryTableProps = {
  items: OverviewItem[];
  pageSize: number;
  page: number;
  totalPages: number;
  total: number;
  sortBy: OverviewSortKey;
  sortDir: SortDirection;
  isLoading: boolean;
  // True while a previous result is still on screen and the next one loads.
  isRefreshing: boolean;
  isError: boolean;
  hasActiveFilters: boolean;
  pendingFlagId?: string;
  pendingExportSku?: string;
  onRetry: () => void;
  onSortChange: (key: OverviewSortKey) => void;
  onPageChange: (page: number) => void;
  onToggleFlag: (item: OverviewItem) => void;
  // The Export CSV button only exists when this is passed (feature flag).
  onExportCsv?: (item: OverviewItem) => void;
};

export function InventoryTable({
  items,
  pageSize,
  page,
  totalPages,
  total,
  sortBy,
  sortDir,
  isLoading,
  isRefreshing,
  isError,
  hasActiveFilters,
  pendingFlagId,
  pendingExportSku,
  onRetry,
  onSortChange,
  onPageChange,
  onToggleFlag,
  onExportCsv,
}: InventoryTableProps) {
  const showRows = items.length > 0;
  const showEmpty = !isLoading && !isError && !showRows;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <>
      {/* The wrapper always reserves the height of a full page of rows, so
          loading, empty, error and short last pages never move what is below. */}
      <div
        className="inv-table-wrap"
        style={{ "--inv-rows": pageSize } as React.CSSProperties}
        aria-busy={isLoading || isRefreshing}
      >
        <table className="data-table inv-table">
          <caption className="sr-only">
            Inventory by product and location
          </caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={column.numeric ? "inv-num" : undefined}
                  aria-sort={
                    sortBy === column.key
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    className="inv-sort"
                    onClick={() => onSortChange(column.key)}
                  >
                    {column.label}
                    <span aria-hidden="true" className="inv-sort-icon">
                      {sortBy === column.key
                        ? sortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </span>
                  </button>
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody className={isRefreshing ? "inv-stale" : undefined}>
            {isLoading &&
              !showRows &&
              Array.from({ length: pageSize }, (_, index) => (
                <tr key={index} className="inv-skeleton-row" aria-hidden="true">
                  {Array.from({ length: columns.length + 1 }, (_, cell) => (
                    <td key={cell}>
                      <span className="inv-skeleton" />
                    </td>
                  ))}
                </tr>
              ))}

            {items.map((item) => (
              <tr key={item.id}>
                <td title={item.productName}>
                  <strong>{item.productName}</strong>
                </td>
                <td>{item.sku}</td>
                <td>
                  <span className="location-code">{item.locationCode}</span>
                </td>
                <td className="inv-num">{item.onHand}</td>
                <td className="inv-num">
                  <strong>{item.available}</strong>
                </td>
                <td>
                  <Badge variant={statusVariant[item.status]}>
                    {statusLabels[item.status]}
                  </Badge>
                </td>
                <td>
                  {item.lastMovementAt
                    ? dateFormat.format(new Date(item.lastMovementAt))
                    : "—"}
                </td>
                <td className="inv-actions">
                  <div className="inv-actions-group">
                    <Button
                      type="button"
                      variant={item.cycleCountFlaggedAt ? "primary" : "secondary"}
                      disabled={pendingFlagId === item.id}
                      aria-label={
                        item.cycleCountFlaggedAt
                          ? `Flagged: ${item.sku} at ${item.locationCode}. Remove cycle count flag`
                          : `Flag ${item.sku} at ${item.locationCode} for cycle count`
                      }
                      onClick={() => onToggleFlag(item)}
                    >
                      {item.cycleCountFlaggedAt ? "Flagged" : "Flag"}
                    </Button>
                    {onExportCsv && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pendingExportSku === item.sku}
                        title="Download all stock movements of this SKU, every location"
                        aria-label={`Export stock movements of ${item.sku} as CSV`}
                        onClick={() => onExportCsv(item)}
                      >
                        Export CSV
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isError && !showRows && (
          <div className="inv-table-state table-state error" role="alert">
            <p>Failed to load inventory.</p>
            <Button type="button" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}

        {showEmpty && (
          <div className="inv-table-state table-state">
            {hasActiveFilters
              ? "No inventory matches these filters."
              : "No inventory found."}
          </div>
        )}
      </div>

      <nav className="inv-pagination" aria-label="Inventory pagination">
        <p aria-live="polite">
          {total === 0
            ? "No results"
            : `Showing ${rangeStart}–${rangeEnd} of ${total.toLocaleString()}`}
        </p>
        <div className="inv-pagination-controls">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </nav>
    </>
  );
}
