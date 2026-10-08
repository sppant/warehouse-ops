import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import {
  getInventory,
  type InventoryItem,
} from "../features/inventory/api";

export function InventoryPage() {
  const [search, setSearch] = useState("");

  const inventoryQuery = useQuery({
    queryKey: ["inventory", search],
    queryFn: () => getInventory(search),
  });

  const items = inventoryQuery.data?.data ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Inventory"
        description="Monitor stock levels across warehouses and locations."
      />

      <Card>
        <div className="inventory-toolbar">
          <Input
            placeholder="Search SKU, product or location..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {inventoryQuery.isLoading && (
          <div className="table-state">Loading inventory...</div>
        )}

        {inventoryQuery.isError && (
          <div className="table-state table-state-error">
            Failed to load inventory.
          </div>
        )}

        {!inventoryQuery.isLoading &&
          !inventoryQuery.isError &&
          items.length === 0 && (
            <div className="table-state">
              No inventory found.
            </div>
          )}

        {items.length > 0 && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Location</th>
                  <th>On hand</th>
                  <th>Reserved</th>
                  <th>Damaged</th>
                  <th>Available</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item: InventoryItem) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.productName}</strong>
                    </td>
                    <td>{item.sku}</td>
                    <td>
                      <span className="location-code">
                        {item.locationCode}
                      </span>
                    </td>
                    <td>{item.onHand}</td>
                    <td>{item.reserved}</td>
                    <td>{item.damaged}</td>
                    <td>
                      <strong>{item.available}</strong>
                    </td>
                    <td>
                      <Badge
                        variant={
                          item.available > 0 ? "success" : "warning"
                        }
                      >
                        {item.available > 0 ? "In stock" : "Out of stock"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
