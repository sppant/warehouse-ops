import { useEffect, useState } from "react";
import { getInventory, type InventoryItem } from "../features/inventory/api";
import {
  approveCycleCount,
  getCycleCounts,
  recordCycleCount,
  rejectCycleCount,
  type CycleCount,
  type CycleCountStatus,
} from "../features/cycle-counts/api";

const statusLabels: Record<CycleCountStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusClass(status: CycleCountStatus) {
  return `po-status po-status-${status.toLowerCase()}`;
}

function differenceClass(difference: number) {
  if (difference === 0) {
    return "cc-difference cc-difference-zero";
  }

  return difference > 0
    ? "cc-difference cc-difference-positive"
    : "cc-difference cc-difference-negative";
}

export function CycleCountsPage() {
  const [counts, setCounts] = useState<CycleCount[]>([]);
  const [positions, setPositions] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [positionId, setPositionId] = useState("");
  const [countedQuantity, setCountedQuantity] = useState("");
  const [reason, setReason] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [cycleCounts, inventoryResponse] = await Promise.all([
        getCycleCounts(),
        getInventory(),
      ]);

      setCounts(cycleCounts);
      setPositions(inventoryResponse.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cycle counts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function resetForm() {
    setPositionId("");
    setCountedQuantity("");
    setReason("");
  }

  const selectedPosition = positions.find((position) => position.id === positionId);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPosition) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await recordCycleCount({
        productId: selectedPosition.productId,
        locationId: selectedPosition.locationId,
        countedQuantity: Number(countedQuantity),
        reason: reason.trim() || undefined,
      });

      resetForm();
      setShowCreate(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record cycle count");
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(id: string, action: "approve" | "reject") {
    setReviewingId(id);
    setError("");

    try {
      const updated =
        action === "approve"
          ? await approveCycleCount(id)
          : await rejectCycleCount(id);

      setCounts((current) =>
        current.map((count) =>
          count.id === updated.id ? { ...count, ...updated } : count,
        ),
      );

      if (action === "approve") {
        const positionsResponse = await getInventory();
        setPositions(positionsResponse.data);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${action} cycle count`,
      );
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">WAREHOUSE</div>
          <h1>Cycle Counts</h1>
          <p>Record physical counts and reconcile discrepancies against inventory.</p>
        </div>

        <button
          className="ui-button ui-button-primary"
          type="button"
          onClick={() => {
            setError("");
            setShowCreate(true);
          }}
        >
          + Record count
        </button>
      </div>

      {error && <div className="po-error">{error}</div>}

      <div className="card po-table-card">
        {loading ? (
          <div className="po-empty">Loading cycle counts...</div>
        ) : counts.length === 0 ? (
          <div className="po-empty">
            <strong>No cycle counts yet</strong>
            <span>Record your first physical count to start reconciling inventory.</span>
          </div>
        ) : (
          <div className="po-table-wrapper">
            <table className="po-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Location</th>
                  <th>Expected</th>
                  <th>Counted</th>
                  <th>Difference</th>
                  <th>Status</th>
                  <th>Counted on</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {counts.map((count) => (
                  <tr key={count.id}>
                    <td>
                      {count.productName}
                      <div className="cc-sku">{count.sku}</div>
                    </td>
                    <td>{count.locationCode}</td>
                    <td>{count.expectedQuantity}</td>
                    <td>{count.countedQuantity}</td>
                    <td>
                      <span className={differenceClass(count.difference)}>
                        {count.difference > 0 ? "+" : ""}
                        {count.difference}
                      </span>
                    </td>
                    <td>
                      <span className={statusClass(count.status)}>
                        {statusLabels[count.status]}
                      </span>
                    </td>
                    <td>{formatDate(count.createdAt)}</td>
                    <td>
                      {count.status === "PENDING" && (
                        <div className="cc-review-actions">
                          <button
                            className="ui-button ui-button-secondary"
                            type="button"
                            disabled={reviewingId === count.id}
                            onClick={() => void handleReview(count.id, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            className="po-remove-item"
                            type="button"
                            disabled={reviewingId === count.id}
                            onClick={() => void handleReview(count.id, "reject")}
                            aria-label="Reject"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                <div className="eyebrow">WAREHOUSE</div>
                <h2>Record cycle count</h2>
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
                  <span>Position</span>
                  <select
                    required
                    value={positionId}
                    onChange={(event) => setPositionId(event.target.value)}
                  >
                    <option value="">Select a position</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.sku} · {position.productName} @{" "}
                        {position.locationCode} (on hand: {position.onHand})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Counted quantity</span>
                  <input
                    required
                    min="0"
                    type="number"
                    value={countedQuantity}
                    onChange={(event) => setCountedQuantity(event.target.value)}
                    placeholder="69"
                  />
                </label>

                <label>
                  <span>Reason (optional)</span>
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Shelf recount"
                  />
                </label>
              </div>

              {selectedPosition && (
                <p className="cc-expected-hint">
                  Expected on hand at this position: {selectedPosition.onHand}
                </p>
              )}

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
                  {saving ? "Recording..." : "Record count"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
