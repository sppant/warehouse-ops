import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  allocateSalesOrder,
  createSalesOrder,
  getSalesOrder,
  getSalesOrders,
  packSalesOrder,
  shipSalesOrder,
  type SalesOrder,
  type SalesOrderDetail,
  type SalesOrderStatus,
} from "../features/sales-orders/api";

type TransitionAction = "allocate" | "pack" | "ship";

type Product = {
  id: string;
  sku: string;
  name: string;
};

type LineItem = {
  productId: string;
  quantity: string;
};

const statusLabels: Record<SalesOrderStatus, string> = {
  PENDING: "Pending",
  ALLOCATED: "Allocated",
  PICKING: "Picking",
  PICKED: "Picked",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  CANCELLED: "Cancelled",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusClass(status: SalesOrderStatus) {
  return `po-status po-status-${status.toLowerCase().replaceAll("_", "-")}`;
}

export function OrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedOrder, setSelectedOrder] =
    useState<SalesOrderDetail | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<TransitionAction | null>(
    null,
  );
  const [error, setError] = useState("");

  const [orderNumber, setOrderNumber] = useState("");
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    {
      productId: "",
      quantity: "",
    },
  ]);
  const [saving, setSaving] = useState(false);

  async function loadOrders() {
    setLoading(true);
    setError("");

    try {
      const [salesOrders, productResponse] = await Promise.all([
        getSalesOrders(),
        apiFetch<{ data: Product[] }>("/api/products"),
      ]);

      setOrders(salesOrders);
      setProducts(productResponse.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  async function openDetails(id: string) {
    setDetailsLoading(true);
    setError("");

    try {
      const order = await getSalesOrder(id);
      setSelectedOrder(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setDetailsLoading(false);
    }
  }

  function resetForm() {
    setOrderNumber("");
    setCustomer("");
    setItems([
      {
        productId: "",
        quantity: "",
      },
    ]);
  }

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      {
        productId: "",
        quantity: "",
      },
    ]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await createSalesOrder({
        orderNumber: orderNumber.trim(),
        customer: customer.trim(),
        items: items.map((item) => ({
          productId: item.productId,
          orderedQuantity: Number(item.quantity),
        })),
      });

      resetForm();
      setShowCreate(false);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSaving(false);
    }
  }

  async function handleTransition(
    action: TransitionAction,
    run: (id: string) => Promise<SalesOrder>,
    failureMessage: string,
  ) {
    if (!selectedOrder) {
      return;
    }

    setActionLoading(action);
    setError("");

    try {
      await run(selectedOrder.id);
      const refreshed = await getSalesOrder(selectedOrder.id);

      setSelectedOrder(refreshed);
      setOrders((current) =>
        current.map((order) =>
          order.id === refreshed.id ? { ...order, ...refreshed } : order,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : failureMessage);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">FULFILLMENT</div>
          <h1>Orders</h1>
          <p>Track customer orders from placement through shipping.</p>
        </div>

        <button
          className="ui-button ui-button-primary"
          type="button"
          onClick={() => {
            setError("");
            setShowCreate(true);
          }}
        >
          + New order
        </button>
      </div>

      {error && <div className="po-error">{error}</div>}

      <div className="card po-table-card">
        {loading ? (
          <div className="po-empty">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="po-empty">
            <strong>No orders yet</strong>
            <span>Create your first order to start tracking fulfillment.</span>
          </div>
        ) : (
          <div className="po-table-wrapper">
            <table className="po-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <button
                        className="po-order-link"
                        type="button"
                        onClick={() => void openDetails(order.id)}
                      >
                        {order.orderNumber}
                      </button>
                    </td>
                    <td>{order.customer}</td>
                    <td>
                      <span className={statusClass(order.status)}>
                        {statusLabels[order.status]}
                      </span>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <button
                        className="po-view-button"
                        type="button"
                        onClick={() => void openDetails(order.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailsLoading && (
        <div className="po-modal-backdrop">
          <div className="po-modal">
            <div className="po-modal-header">
              <h2>Order</h2>
            </div>
            <div className="po-empty">Loading...</div>
          </div>
        </div>
      )}

      {selectedOrder && !detailsLoading && (
        <div
          className="po-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedOrder(null);
            }
          }}
        >
          <div className="po-modal">
            <div className="po-modal-header">
              <div>
                <div className="eyebrow">SALES ORDER</div>
                <h2>{selectedOrder.orderNumber}</h2>
              </div>

              <button
                className="po-close"
                type="button"
                onClick={() => setSelectedOrder(null)}
              >
                ×
              </button>
            </div>

            <div className="po-detail-grid">
              <div>
                <span>Customer</span>
                <strong>{selectedOrder.customer}</strong>
              </div>

              <div>
                <span>Created</span>
                <strong>{formatDate(selectedOrder.createdAt)}</strong>
              </div>

              <div>
                <span>Status</span>
                <span className={statusClass(selectedOrder.status)}>
                  {statusLabels[selectedOrder.status]}
                </span>
              </div>

              {selectedOrder.status === "PENDING" && (
                <div>
                  <span>Allocation</span>
                  <button
                    className="ui-button ui-button-secondary"
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={() =>
                      void handleTransition(
                        "allocate",
                        allocateSalesOrder,
                        "Failed to allocate order",
                      )
                    }
                  >
                    {actionLoading === "allocate"
                      ? "Allocating..."
                      : "Allocate stock"}
                  </button>
                </div>
              )}

              {selectedOrder.status === "PICKED" && (
                <div>
                  <span>Packing</span>
                  <button
                    className="ui-button ui-button-secondary"
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={() =>
                      void handleTransition(
                        "pack",
                        packSalesOrder,
                        "Failed to pack order",
                      )
                    }
                  >
                    {actionLoading === "pack" ? "Packing..." : "Mark as packed"}
                  </button>
                </div>
              )}

              {selectedOrder.status === "PACKED" && (
                <div>
                  <span>Shipping</span>
                  <button
                    className="ui-button ui-button-secondary"
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={() =>
                      void handleTransition(
                        "ship",
                        shipSalesOrder,
                        "Failed to ship order",
                      )
                    }
                  >
                    {actionLoading === "ship" ? "Shipping..." : "Mark as shipped"}
                  </button>
                </div>
              )}
            </div>

            <div className="po-items">
              <div className="po-section-title">Items</div>

              <table className="po-items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Ordered</th>
                    <th>Allocated</th>
                    <th>Picked</th>
                    <th>Shipped</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productName}</td>
                      <td>{item.sku}</td>
                      <td>{item.orderedQuantity}</td>
                      <td>{item.allocatedQuantity}</td>
                      <td>{item.pickedQuantity}</td>
                      <td>{item.shippedQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div
          className="po-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowCreate(false);
            }
          }}
        >
          <div className="po-modal po-create-modal">
            <div className="po-modal-header">
              <div>
                <div className="eyebrow">FULFILLMENT</div>
                <h2>New order</h2>
              </div>

              <button
                className="po-close"
                type="button"
                onClick={() => setShowCreate(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="po-form-grid">
                <label>
                  <span>Order number</span>
                  <input
                    required
                    value={orderNumber}
                    onChange={(event) => setOrderNumber(event.target.value)}
                    placeholder="SO-1002"
                  />
                </label>

                <label>
                  <span>Customer</span>
                  <input
                    required
                    value={customer}
                    onChange={(event) => setCustomer(event.target.value)}
                    placeholder="Customer name"
                  />
                </label>
              </div>

              <div className="po-items-form">
                <div className="po-section-heading">
                  <div>
                    <div className="po-section-title">Line items</div>
                    <p>Add the products and quantities this customer ordered.</p>
                  </div>

                  <button
                    className="ui-button ui-button-secondary"
                    type="button"
                    onClick={addItem}
                  >
                    + Add item
                  </button>
                </div>

                {items.map((item, index) => (
                  <div className="po-line-item" key={index}>
                    <label>
                      <span>Product</span>
                      <select
                        required
                        value={item.productId}
                        onChange={(event) =>
                          updateItem(index, "productId", event.target.value)
                        }
                      >
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.sku} · {product.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Quantity</span>
                      <input
                        required
                        min="1"
                        type="number"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, "quantity", event.target.value)
                        }
                        placeholder="5"
                      />
                    </label>

                    {items.length > 1 && (
                      <button
                        className="po-remove-item"
                        type="button"
                        onClick={() => removeItem(index)}
                        aria-label="Remove item"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="po-form-actions">
                <button
                  className="ui-button ui-button-secondary"
                  type="button"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>

                <button
                  className="ui-button ui-button-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Creating..." : "Create order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
