import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import {
  getProducts,
  type Product,
} from "../features/products/api";
import {
  getWarehouses,
  getLocations,
  type Warehouse,
  type Location,
} from "../features/warehouses/api";
import {
  receiveStock,
} from "../features/receiving/api";

export function ReceivingPage() {
  const queryClient = useQueryClient();

  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts(),
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => getWarehouses(),
  });

  const locationsQuery = useQuery({
    queryKey: ["locations", warehouseId],
    queryFn: () => getLocations(warehouseId),
    enabled: Boolean(warehouseId),
  });

  useEffect(() => {
    const products = productsQuery.data?.data ?? [];

    if (!productId && products.length > 0) {
      setProductId(products[0].id);
    }
  }, [productsQuery.data, productId]);

  useEffect(() => {
    const warehouses = warehousesQuery.data?.data ?? [];

    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehousesQuery.data, warehouseId]);

  useEffect(() => {
    const locations = locationsQuery.data?.data ?? [];

    if (locations.length === 0) {
      setLocationId("");
      return;
    }

    if (!locations.some((location) => location.id === locationId)) {
      setLocationId(locations[0].id);
    }
  }, [locationsQuery.data, locationId]);

  const receiveMutation = useMutation({
    mutationFn: receiveStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setQuantity("");
      setReason("");
    },
  });

  const selectedProduct = (productsQuery.data?.data ?? []).find(
    (product: Product) => product.id === productId,
  );

  const selectedWarehouse = (warehousesQuery.data?.data ?? []).find(
    (warehouse: Warehouse) => warehouse.id === warehouseId,
  );

  const selectedLocation = (locationsQuery.data?.data ?? []).find(
    (location: Location) => location.id === locationId,
  );

  const quantityValue = Number(quantity);
  const canSubmit =
    Boolean(productId) &&
    Boolean(locationId) &&
    Number.isInteger(quantityValue) &&
    quantityValue > 0 &&
    !receiveMutation.isPending;

  const handleWarehouseChange = (value: string) => {
    setWarehouseId(value);
    setLocationId("");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    receiveMutation.mutate({
      productId,
      locationId,
      quantity: quantityValue,
      reason: reason.trim() || undefined,
    });
  };

  return (
    <div className="page">
      <PageHeader
        title="Receiving"
        description="Receive incoming stock into a warehouse location."
      />

      <Card className="receiving-card">
        <div className="receiving-layout">
          <form className="receiving-form" onSubmit={handleSubmit}>
            <div className="receiving-section-label">Receipt details</div>

            <div className="receiving-fields">
              <div className="receiving-field">
                <label htmlFor="receiving-product">Product</label>
                <select
                  id="receiving-product"
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                >
                  {(productsQuery.data?.data ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.sku} · {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="receiving-field">
                <label htmlFor="receiving-warehouse">Warehouse</label>
                <select
                  id="receiving-warehouse"
                  value={warehouseId}
                  onChange={(event) =>
                    handleWarehouseChange(event.target.value)
                  }
                >
                  {(warehousesQuery.data?.data ?? []).map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} · {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="receiving-field">
                <label htmlFor="receiving-location">Storage location</label>
                <select
                  id="receiving-location"
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                  disabled={locationsQuery.isLoading}
                >
                  {(locationsQuery.data?.data ?? []).map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.code} · {location.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="receiving-field">
                <label htmlFor="receiving-quantity">Quantity</label>
                <input
                  id="receiving-quantity"
                  className="receiving-quantity-input"
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="receiving-field receiving-field-full">
                <label htmlFor="receiving-reason">Reason</label>
                <input
                  id="receiving-reason"
                  type="text"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Optional receiving note"
                  maxLength={500}
                />
              </div>

              {receiveMutation.isError && (
                <div className="receiving-status receiving-status-error receiving-field-full">
                  Failed to receive stock. Please check the selected product,
                  location, and quantity.
                </div>
              )}

              {receiveMutation.isSuccess && (
                <div className="receiving-status receiving-status-success receiving-field-full">
                  Stock received successfully.
                </div>
              )}

              <div className="receiving-actions receiving-field-full">
                <Button type="submit" disabled={!canSubmit}>
                  {receiveMutation.isPending ? "Receiving..." : "Receive stock"}
                </Button>
              </div>
            </div>
          </form>

          <aside className="receiving-summary">
            <h2 className="receiving-summary-title">Receipt summary</h2>

            <p className="receiving-summary-description">
              Review the destination before adding stock to inventory.
            </p>

            <div className="receiving-summary-list">
              <div className="receiving-summary-item">
                <span className="receiving-summary-label">Product</span>
                <span className="receiving-summary-value">
                  {selectedProduct?.sku ?? "—"}
                </span>
              </div>

              <div className="receiving-summary-item">
                <span className="receiving-summary-label">Warehouse</span>
                <span className="receiving-summary-value">
                  {selectedWarehouse?.code ?? "—"}
                </span>
              </div>

              <div className="receiving-summary-item">
                <span className="receiving-summary-label">Location</span>
                <span className="receiving-summary-value">
                  {selectedLocation?.code ?? "—"}
                </span>
              </div>
            </div>

            <div className="receiving-summary-quantity">
              <div className="receiving-summary-quantity-label">
                Units received
              </div>

              <div className="receiving-summary-quantity-value">
                {Number.isFinite(quantityValue) && quantityValue > 0
                  ? quantityValue
                  : 0}
              </div>
            </div>
          </aside>
        </div>
      </Card>
    </div>
  );
}
