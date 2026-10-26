import { useId } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import type { StockStatus } from "./overview";

export const statusLabels: Record<StockStatus, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
};

type InventoryFiltersProps = {
  locations: Array<{ id: string; label: string }>;
  locationId: string;
  status: StockStatus | "";
  search: string;
  onLocationChange: (locationId: string) => void;
  onStatusChange: (status: StockStatus | "") => void;
  onSearchChange: (search: string) => void;
  onClear: () => void;
};

export function InventoryFilters({
  locations,
  locationId,
  status,
  search,
  onLocationChange,
  onStatusChange,
  onSearchChange,
  onClear,
}: InventoryFiltersProps) {
  const id = useId();
  const hasActiveFilters = Boolean(locationId || status || search);

  return (
    <form
      className="inv-filters"
      role="search"
      aria-label="Filter inventory"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="inv-field inv-field-search">
        <label htmlFor={`${id}-search`}>Search</label>
        <Input
          id={`${id}-search`}
          type="search"
          placeholder="SKU, product or location"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="inv-field">
        <label htmlFor={`${id}-location`}>Location</label>
        <select
          id={`${id}-location`}
          className="ui-input"
          value={locationId}
          onChange={(event) => onLocationChange(event.target.value)}
        >
          <option value="">All locations</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.label}
            </option>
          ))}
        </select>
      </div>

      <div className="inv-field">
        <label htmlFor={`${id}-status`}>Status</label>
        <select
          id={`${id}-status`}
          className="ui-input"
          value={status}
          onChange={(event) =>
            onStatusChange(event.target.value as StockStatus | "")
          }
        >
          <option value="">All statuses</option>
          {(Object.keys(statusLabels) as StockStatus[]).map((value) => (
            <option key={value} value={value}>
              {statusLabels[value]}
            </option>
          ))}
        </select>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={onClear}
        disabled={!hasActiveFilters}
      >
        Clear filters
      </Button>
    </form>
  );
}
