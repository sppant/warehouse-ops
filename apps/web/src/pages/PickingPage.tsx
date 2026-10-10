import { useEffect, useState } from "react";
import {
  getPickTask,
  getPickTasks,
  pickItem,
  type PickTask,
  type PickTaskDetail,
  type PickTaskStatus,
} from "../features/picking/api";

const statusLabels: Record<PickTaskStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
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

function statusClass(status: PickTaskStatus) {
  return `po-status po-status-${status.toLowerCase().replaceAll("_", "-")}`;
}

export function PickingPage() {
  const [tasks, setTasks] = useState<PickTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<PickTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [pickingItemId, setPickingItemId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function loadTasks() {
    setLoading(true);
    setError("");

    try {
      setTasks(await getPickTasks());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pick tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  async function openDetails(id: string) {
    setDetailsLoading(true);
    setError("");

    try {
      const task = await getPickTask(id);
      setSelectedTask(task);
      setQuantities(
        Object.fromEntries(
          task.items.map((item) => [
            item.id,
            String(item.quantity - item.pickedQuantity),
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pick task");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handlePick(itemId: string) {
    const quantity = Number(quantities[itemId]);

    if (!quantity || quantity <= 0) {
      return;
    }

    setPickingItemId(itemId);
    setError("");

    try {
      await pickItem(itemId, { quantity });

      if (selectedTask) {
        const refreshed = await getPickTask(selectedTask.id);
        setSelectedTask(refreshed);
        setQuantities(
          Object.fromEntries(
            refreshed.items.map((item) => [
              item.id,
              String(item.quantity - item.pickedQuantity),
            ]),
          ),
        );
        setTasks((current) =>
          current.map((task) =>
            task.id === refreshed.id ? { ...task, ...refreshed } : task,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record pick");
    } finally {
      setPickingItemId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">WAREHOUSE</div>
          <h1>Picking</h1>
          <p>Work open pick tasks generated from allocated orders.</p>
        </div>
      </div>

      {error && <div className="po-error">{error}</div>}

      <div className="card po-table-card">
        {loading ? (
          <div className="po-empty">Loading pick tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="po-empty">
            <strong>No pick tasks yet</strong>
            <span>Generate a pick task from an allocated order to see it here.</span>
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
                  <th>Completed</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <button
                        className="po-order-link"
                        type="button"
                        onClick={() => void openDetails(task.id)}
                      >
                        {task.orderNumber}
                      </button>
                    </td>
                    <td>{task.customer}</td>
                    <td>
                      <span className={statusClass(task.status)}>
                        {statusLabels[task.status]}
                      </span>
                    </td>
                    <td>{formatDate(task.createdAt)}</td>
                    <td>{formatDate(task.completedAt)}</td>
                    <td>
                      <button
                        className="po-view-button"
                        type="button"
                        onClick={() => void openDetails(task.id)}
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
              <h2>Pick task</h2>
            </div>
            <div className="po-empty">Loading...</div>
          </div>
        </div>
      )}

      {selectedTask && !detailsLoading && (
        <div
          className="po-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedTask(null);
            }
          }}
        >
          <div className="po-modal">
            <div className="po-modal-header">
              <div>
                <div className="eyebrow">PICK TASK</div>
                <h2>{selectedTask.orderNumber}</h2>
              </div>

              <button
                className="po-close"
                type="button"
                onClick={() => setSelectedTask(null)}
              >
                ×
              </button>
            </div>

            <div className="po-detail-grid">
              <div>
                <span>Customer</span>
                <strong>{selectedTask.customer}</strong>
              </div>

              <div>
                <span>Status</span>
                <span className={statusClass(selectedTask.status)}>
                  {statusLabels[selectedTask.status]}
                </span>
              </div>

              <div>
                <span>Completed</span>
                <strong>{formatDate(selectedTask.completedAt)}</strong>
              </div>
            </div>

            <div className="po-items">
              <div className="po-section-title">Items to pick</div>

              <table className="po-items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Location</th>
                    <th>Qty</th>
                    <th>Picked</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {selectedTask.items.map((item) => {
                    const remaining = item.quantity - item.pickedQuantity;

                    return (
                      <tr key={item.id}>
                        <td>{item.productName}</td>
                        <td>{item.sku}</td>
                        <td>{item.locationCode}</td>
                        <td>{item.quantity}</td>
                        <td>{item.pickedQuantity}</td>
                        <td>
                          {remaining > 0 ? (
                            <div className="pick-action">
                              <input
                                className="pick-quantity-input"
                                type="number"
                                min="1"
                                max={remaining}
                                value={quantities[item.id] ?? ""}
                                onChange={(event) =>
                                  setQuantities((current) => ({
                                    ...current,
                                    [item.id]: event.target.value,
                                  }))
                                }
                              />
                              <button
                                className="ui-button ui-button-secondary"
                                type="button"
                                disabled={pickingItemId === item.id}
                                onClick={() => void handlePick(item.id)}
                              >
                                {pickingItemId === item.id ? "Picking..." : "Pick"}
                              </button>
                            </div>
                          ) : (
                            <span className="pick-done">Done</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
