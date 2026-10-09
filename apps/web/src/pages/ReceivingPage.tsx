import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import {
  getPurchaseOrder,
  getPurchaseOrders,
  receivePurchaseOrderItem,
  type PurchaseOrder,
  type PurchaseOrderDetail,
} from "../features/purchase-orders/api";
import {
  getWarehouses,
  getLocations,
  type Warehouse,
  type Location,
} from "../features/warehouses/api";

export function ReceivingPage() {
  const queryClient = useQueryClient();
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [purchaseOrderItemId, setPurchaseOrderItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: getPurchaseOrders,
  });

  const orderDetailsQuery = useQuery({
    queryKey: ["purchase-order", purchaseOrderId],
    queryFn: () => getPurchaseOrder(purchaseOrderId),
    enabled: Boolean(purchaseOrderId),
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

  const openOrders = useMemo(
    () =>
      (ordersQuery.data ?? []).filter(
        (order: PurchaseOrder) =>
          order.status === "ORDERED" ||
          order.status === "PARTIALLY_RECEIVED",
      ),
    [ordersQuery.data],
  );

  const selectedOrder: PurchaseOrderDetail | undefined =
    orderDetailsQuery.data;

  const receivableItems = useMemo(
    () =>
      (selectedOrder?.items ?? []).filter(
        (item) => item.receivedQuantity < item.orderedQuantity,
      ),
    [selectedOrder],
  );

  useEffect(() => {
    if (
      openOrders.length > 0 &&
      !openOrders.some((order) => order.id === purchaseOrderId)
    ) {
      setPurchaseOrderId(openOrders[0].id);
      setPurchaseOrderItemId("");
    }

    if (openOrders.length === 0 && purchaseOrderId) {
      setPurchaseOrderId("");
      setPurchaseOrderItemId("");
    }
  }, [openOrders, purchaseOrderId]);

  useEffect(() => {
    if (
      receivableItems.length > 0 &&
      !receivableItems.some((item) => item.id === purchaseOrderItemId)
    ) {
      setPurchaseOrderItemId(receivableItems[0].id);
    }

    if (receivableItems.length === 0 && purchaseOrderItemId) {
      setPurchaseOrderItemId("");
    }
  }, [receivableItems, purchaseOrderItemId]);

  useEffect(() => {
    const warehouses = warehousesQuery.data?.data ?? [];
    if (
      warehouses.length > 0 &&
      !warehouses.some((warehouse: Warehouse) => warehouse.id === warehouseId)
    ) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehousesQuery.data, warehouseId]);

  useEffect(() => {
    const locations = locationsQuery.data?.data ?? [];
    if (
      locations.length > 0 &&
      !locations.some((location: Location) => location.id === locationId)
    ) {
      setLocationId(locations[0].id);
    }

    if (locations.length === 0 && locationId) {
      setLocationId("");
    }
  }, [locationsQuery.data, locationId]);

  const selectedItem = receivableItems.find(
    (item) => item.id === purchaseOrderItemId,
  );

  const selectedWarehouse = (warehousesQuery.data?.data ?? []).find(
    (warehouse: Warehouse) => warehouse.id === warehouseId,
  );

  const selectedLocation = (locationsQuery.data?.data ?? []).find(
    (location: Location) => location.id === locationId,
  );

  const quantityValue = Number(quantity);
  const remainingQuantity = selectedItem
    ? selectedItem.orderedQuantity - selectedItem.receivedQuantity
    : 0;

  const receiveMutation = useMutation({
    mutationFn: () =>
      receivePurchaseOrderItem(purchaseOrderItemId, {
        locationId,
        quantity: quantityValue,
        reason: reason.trim() || undefined,
      }),
    onSuccess: async () => {
      setQuantity("");
      setReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
        queryClient.invalidateQueries({
          queryKey: ["purchase-order", purchaseOrderId],
        }),
        ordersQuery.refetch(),
        orderDetailsQuery.refetch(),
      ]);
    },
  });


  const canSubmit =
    Boolean(purchaseOrderId) &&
    Boolean(purchaseOrderItemId) &&
    Boolean(locationId) &&
    Number.isInteger(quantityValue) &&
    quantityValue > 0 &&
    quantityValue <= remainingQuantity &&
    !orderDetailsQuery.isLoading &&
    !receiveMutation.isPending;

  function handleWarehouseChange(value: string) {
    setWarehouseId(value);
    setLocationId("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    receiveMutation.mutate();
  }

  const errorMessage =
    receiveMutation.error instanceof Error
      ? receiveMutation.error.message
      : ordersQuery.error instanceof Error
        ? ordersQuery.error.message
        : orderDetailsQuery.error instanceof Error
          ? orderDetailsQuery.error.message
          : locationsQuery.error instanceof Error
            ? locationsQuery.error.message
            : "";

  return (
    <div className="page">
      <PageHeader
        title="Receiving"
        description="Receive purchase order items into a warehouse location."
      />
      <Card className="receiving-card">
        <div className="receiving-layout">
          <form className="receiving-form" onSubmit={handleSubmit}>
            <div className="receiving-section-label">Receipt details</div>
            <div className="receiving-fields">
              <div className="receiving-field receiving-field-full">
                <label htmlFor="receiving-order">Purchase order</label>
                <select
                  id="receiving-order"
                  value={purchaseOrderId}
                  onChange={(event) => {
                    setPurchaseOrderId(event.target.value);
                    setPurchaseOrderItemId("");
                    setQuantity("");
                  }}
                  disabled={ordersQuery.isLoading || openOrders.length === 0}
                >
                  {openOrders.length === 0 && (
                    <option value="">No open purchase orders</option>
                  )}
                  {openOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber} · {order.supplier} · {order.status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="receiving-field receiving-field-full">
                <label htmlFor="receiving-item">Purchase order item</label>
                <select
                  id="receiving-item"
                  value={purchaseOrderItemId}
                  onChange={(event) => {
                    setPurchaseOrderItemId(event.target.value);
                    setQuantity("");
                  }}
                  disabled={orderDetailsQuery.isLoading || receivableItems.length === 0}
                >
                  {receivableItems.length === 0 && (
                    <option value="">No outstanding items</option>
                  )}
                  {receivableItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} · {item.productName} · {item.receivedQuantity}/{item.orderedQuantity} received
                    </option>
                  ))}
                </select>
              </div>

              <div className="receiving-field">
                <label htmlFor="receiving-warehouse">Warehouse</label>
                <select
                  id="receiving-warehouse"
                  value={warehouseId}
                  onChange={(event) => handleWarehouseChange(event.target.value)}
                  disabled={warehousesQuery.isLoading}
                >
                  {(warehousesQuery.data?.data ?? []).map((warehouse: Warehouse) => (
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
                  disabled={locationsQuery.isLoading || (locationsQuery.data?.data ?? []).length === 0}
                >
                  {(locationsQuery.data?.data ?? []).map((location: Location) => (
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
                  max={remainingQuantity}
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="0"
                />
                {selectedItem && (
                  <span className="receiving-summary-label">
                    {remainingQuantity} units remaining on this PO item
                  </span>
                )}
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

              {ordersQuery.isLoading && (
                <div className="receiving-status receiving-field-full">
                  Loading purchase orders...
                </div>
              )}

              {openOrders.length === 0 && !ordersQuery.isLoading && (
                <div className="receiving-status receiving-field-full">
                  No purchase orders are currently available for receiving. Set a purchase order to Ordered first.
                </div>
              )}

              {errorMessage && (
                <div className="receiving-status receiving-status-error receiving-field-full">
                  {errorMessage}
                </div>
              )}

              {receiveMutation.isSuccess && (
                <div className="receiving-status receiving-status-success receiving-field-full">
                  Stock received successfully and purchase order quantities updated.
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
              Check the purchase order, outstanding quantity, and destination before receiving stock.
            </p>
            <div className="receiving-summary-list">
              <div className="receiving-summary-item">
                <span className="receiving-summary-label">Purchase order</span>
                <span className="receiving-summary-value">
                  {selectedOrder?.orderNumber ?? "—"}
                </span>
              </div>
              <div className="receiving-summary-item">
                <span className="receiving-summary-label">Product</span>
                <span className="receiving-summary-value">
                  {selectedItem?.sku ?? "—"}
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
              <div className="receiving-summary-item">
                <span className="receiving-summary-label">Outstanding</span>
                <span className="receiving-summary-value">
                  {selectedItem ? remainingQuantity : "—"}
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
