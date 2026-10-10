import { useEffect, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import {
  getInventory,
  getInventoryMovements,
  type StockMovement,
} from "../features/inventory/api";
import { getSalesOrders } from "../features/sales-orders/api";
import { getPurchaseOrders } from "../features/purchase-orders/api";
import { getPickTasks } from "../features/picking/api";
import { getCycleCounts } from "../features/cycle-counts/api";

type Metrics = {
  onHand: number;
  available: number;
  reserved: number;
  openPickTasks: number;
  ordersAwaitingAllocation: number;
  pendingCycleCounts: number;
  purchaseOrdersAwaitingReceipt: number;
};

const outboundMovementTypes: ReadonlySet<StockMovement["type"]> = new Set([
  "PICK",
  "DAMAGE",
  "TRANSFER_OUT",
]);

function signedMovementQuantity(movement: StockMovement) {
  if (movement.type === "ADJUSTMENT") {
    return movement.quantity;
  }

  return outboundMovementTypes.has(movement.type)
    ? -Math.abs(movement.quantity)
    : Math.abs(movement.quantity);
}

const movementLabels: Record<StockMovement["type"], string> = {
  RECEIPT: "Received",
  PICK: "Picked",
  DAMAGE: "Damaged",
  RETURN: "Returned",
  ADJUSTMENT: "Adjusted",
  TRANSFER_IN: "Transferred in",
  TRANSFER_OUT: "Transferred out",
};

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);

  return `${days}d ago`;
}

export function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const [
          inventoryResponse,
          salesOrders,
          purchaseOrders,
          pickTasks,
          cycleCounts,
          recentMovements,
        ] = await Promise.all([
          getInventory(),
          getSalesOrders(),
          getPurchaseOrders(),
          getPickTasks(),
          getCycleCounts(),
          getInventoryMovements(),
        ]);

        const inventory = inventoryResponse.data;

        setMetrics({
          onHand: inventory.reduce((sum, row) => sum + row.onHand, 0),
          available: inventory.reduce((sum, row) => sum + row.available, 0),
          reserved: inventory.reduce((sum, row) => sum + row.reserved, 0),
          openPickTasks: pickTasks.filter(
            (task) => task.status === "PENDING" || task.status === "IN_PROGRESS",
          ).length,
          ordersAwaitingAllocation: salesOrders.filter(
            (order) => order.status === "PENDING",
          ).length,
          pendingCycleCounts: cycleCounts.filter(
            (count) => count.status === "PENDING",
          ).length,
          purchaseOrdersAwaitingReceipt: purchaseOrders.filter(
            (order) =>
              order.status === "ORDERED" ||
              order.status === "PARTIALLY_RECEIVED",
          ).length,
        });

        setMovements(recentMovements.slice(0, 6));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const availablePercent =
    metrics && metrics.onHand > 0
      ? Math.round((metrics.available / metrics.onHand) * 100)
      : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Warehouse Dashboard"
        description="Monitor inventory and warehouse activity."
      />

      {error && <div className="po-error">{error}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <span>On-hand units</span>
          <strong>{loading ? "—" : metrics?.onHand ?? 0}</strong>
          <small>Across all locations</small>
        </div>

        <div className="metric-card">
          <span>Available</span>
          <strong>{loading ? "—" : metrics?.available ?? 0}</strong>
          <small>{loading ? "" : `${availablePercent}% of on-hand`}</small>
        </div>

        <div className="metric-card">
          <span>Reserved</span>
          <strong>{loading ? "—" : metrics?.reserved ?? 0}</strong>
          <small>Awaiting fulfillment</small>
        </div>

        <div className="metric-card">
          <span>Open pick tasks</span>
          <strong>{loading ? "—" : metrics?.openPickTasks ?? 0}</strong>
          <small>Pending or in progress</small>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Activity</span>
              <h2>Recent stock movements</h2>
            </div>
          </div>

          {loading ? (
            <div className="chart-placeholder">Loading activity...</div>
          ) : movements.length === 0 ? (
            <div className="chart-placeholder">No stock movements yet.</div>
          ) : (
            <div className="activity-list">
              {movements.map((movement) => {
                const signedQuantity = signedMovementQuantity(movement);

                return (
                  <div className="activity-row" key={movement.id}>
                    <span className="activity-type">
                      {movementLabels[movement.type]}
                    </span>
                    <span className="activity-detail">
                      {movement.sku} · {movement.locationCode}
                    </span>
                    <span
                      className={
                        signedQuantity >= 0
                          ? "activity-quantity activity-quantity-positive"
                          : "activity-quantity activity-quantity-negative"
                      }
                    >
                      {signedQuantity > 0 ? "+" : ""}
                      {signedQuantity}
                    </span>
                    <span className="activity-time">
                      {formatRelativeTime(movement.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Attention</span>
              <h2>Needs attention</h2>
            </div>
          </div>

          <div className="attention-list">
            <div>
              <strong>{loading ? "—" : metrics?.ordersAwaitingAllocation ?? 0}</strong>
              <span>Orders awaiting allocation</span>
            </div>
            <div>
              <strong>{loading ? "—" : metrics?.pendingCycleCounts ?? 0}</strong>
              <span>Pending cycle counts</span>
            </div>
            <div>
              <strong>
                {loading ? "—" : metrics?.purchaseOrdersAwaitingReceipt ?? 0}
              </strong>
              <span>Purchase orders awaiting receipt</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
