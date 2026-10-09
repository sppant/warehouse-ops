import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  createPurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrders,
  updatePurchaseOrderStatus,
  type PurchaseOrder,
  type PurchaseOrderDetail,
  type PurchaseOrderStatus,
} from "../features/purchase-orders/api";

type Product = {
  id: string;
  sku: string;
  name: string;
  unitCost: string;
};

type LineItem = {
  productId: string;
  quantity: string;
  unitCost: string;
};

const statuses: PurchaseOrderStatus[] = [
  "DRAFT",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
];

const statusLabels: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  ORDERED: "Ordered",
  PARTIALLY_RECEIVED: "Partially received",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: string | number) {
  return `€${Number(value).toFixed(2)}`;
}

function statusClass(status: PurchaseOrderStatus) {
  return `po-status po-status-${status.toLowerCase().replaceAll("_", "-")}`;
}

export function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedOrder, setSelectedOrder] =
    useState<PurchaseOrderDetail | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");

  const [orderNumber, setOrderNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    {
      productId: "",
      quantity: "",
      unitCost: "",
    },
  ]);
  const [saving, setSaving] = useState(false);

  async function loadOrders() {
    setLoading(true);
    setError("");

    try {
      const [purchaseOrders, productResponse] = await Promise.all([
        getPurchaseOrders(),
        apiFetch<{ data: Product[] }>("/api/products"),
      ]);

      setOrders(purchaseOrders);
      setProducts(productResponse.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load purchase orders");
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
      const order = await getPurchaseOrder(id);
      setSelectedOrder(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load purchase order");
    } finally {
      setDetailsLoading(false);
    }
  }

  function resetForm() {
    setOrderNumber("");
    setSupplier("");
    setExpectedAt("");
    setItems([
      {
        productId: "",
        quantity: "",
        unitCost: "",
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
        unitCost: "",
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
      await createPurchaseOrder({
        orderNumber: orderNumber.trim(),
        supplier: supplier.trim(),
        ...(expectedAt
          ? {
              expectedAt: new Date(expectedAt).toISOString(),
            }
          : {}),
        items: items.map((item) => ({
          productId: item.productId,
          orderedQuantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
        })),
      });

      resetForm();
      setShowCreate(false);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create purchase order");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: PurchaseOrderStatus) {
    if (!selectedOrder || status === selectedOrder.status) {
      return;
    }

    try {
      const updated = await updatePurchaseOrderStatus(
        selectedOrder.id,
        status,
      );

      setSelectedOrder({
        ...selectedOrder,
        ...updated,
      });

      setOrders((current) =>
        current.map((order) =>
          order.id === updated.id ? { ...order, ...updated } : order,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">PROCUREMENT</div>
          <h1>Purchase Orders</h1>
          <p>Track incoming stock from suppliers.</p>
        </div>

        <button
          className="ui-button ui-button-primary"
          type="button"
          onClick={() => {
            setError("");
            setShowCreate(true);
          }}
        >
          + New purchase order
        </button>
      </div>

      {error && <div className="po-error">{error}</div>}

      <div className="card po-table-card">
        {loading ? (
          <div className="po-empty">Loading purchase orders...</div>
        ) : orders.length === 0 ? (
          <div className="po-empty">
            <strong>No purchase orders yet</strong>
            <span>Create your first purchase order to start tracking incoming stock.</span>
          </div>
        ) : (
          <div className="po-table-wrapper">
            <table className="po-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Expected</th>
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
                    <td>{order.supplier}</td>
                    <td>
                      <span className={statusClass(order.status)}>
                        {statusLabels[order.status]}
                      </span>
                    </td>
                    <td>{formatDate(order.expectedAt)}</td>
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
              <h2>Purchase order</h2>
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
                <div className="eyebrow">PURCHASE ORDER</div>
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
                <span>Supplier</span>
                <strong>{selectedOrder.supplier}</strong>
              </div>

              <div>
                <span>Expected</span>
                <strong>{formatDate(selectedOrder.expectedAt)}</strong>
              </div>

              <div>
                <span>Ordered</span>
                <strong>{formatDate(selectedOrder.orderedAt)}</strong>
              </div>

              <div>
                <span>Status</span>
                <select
                  value={selectedOrder.status}
                  onChange={(event) =>
                    void handleStatusChange(
                      event.target.value as PurchaseOrderStatus,
                    )
                  }
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="po-items">
              <div className="po-section-title">Items</div>

              <table className="po-items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Ordered</th>
                    <th>Received</th>
                    <th>Unit cost</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productName}</td>
                      <td>{item.sku}</td>
                      <td>{item.orderedQuantity}</td>
                      <td>{item.receivedQuantity}</td>
                      <td>{formatCurrency(item.unitCost)}</td>
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
                <div className="eyebrow">PROCUREMENT</div>
                <h2>New purchase order</h2>
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
                    placeholder="PO-1002"
                  />
                </label>

                <label>
                  <span>Supplier</span>
                  <input
                    required
                    value={supplier}
                    onChange={(event) => setSupplier(event.target.value)}
                    placeholder="Supplier name"
                  />
                </label>

                <label>
                  <span>Expected arrival</span>
                  <input
                    type="datetime-local"
                    value={expectedAt}
                    onChange={(event) => setExpectedAt(event.target.value)}
                  />
                </label>
              </div>

              <div className="po-items-form">
                <div className="po-section-heading">
                  <div>
                    <div className="po-section-title">Line items</div>
                    <p>Add the products and quantities expected from this supplier.</p>
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
                        onChange={(event) => {
                          const product = products.find(
                            (entry) => entry.id === event.target.value,
                          );

                          updateItem(
                            index,
                            "productId",
                            event.target.value,
                          );

                          if (
                            product &&
                            !item.unitCost
                          ) {
                            updateItem(
                              index,
                              "unitCost",
                              product.unitCost,
                            );
                          }
                        }}
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
                        placeholder="25"
                      />
                    </label>

                    <label>
                      <span>Unit cost</span>
                      <input
                        required
                        min="0"
                        step="0.01"
                        type="number"
                        value={item.unitCost}
                        onChange={(event) =>
                          updateItem(index, "unitCost", event.target.value)
                        }
                        placeholder="12.50"
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
                  {saving ? "Creating..." : "Create purchase order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
