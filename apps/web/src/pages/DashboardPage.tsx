export function DashboardPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Overview</span>
          <h1>Warehouse Dashboard</h1>
          <p>Monitor inventory and warehouse activity.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Total units</span>
          <strong>12,480</strong>
          <small>Across all locations</small>
        </div>

        <div className="metric-card">
          <span>Available</span>
          <strong>9,842</strong>
          <small>78.9% of inventory</small>
        </div>

        <div className="metric-card">
          <span>Reserved</span>
          <strong>2,138</strong>
          <small>Awaiting fulfillment</small>
        </div>

        <div className="metric-card">
          <span>Low stock</span>
          <strong>18</strong>
          <small>Products need attention</small>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Activity</span>
              <h2>Inventory movement</h2>
            </div>
            <span className="panel-period">Last 7 days</span>
          </div>

          <div className="chart-placeholder">
            Chart will be connected to live inventory data.
          </div>
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
              <strong>18</strong>
              <span>Low stock products</span>
            </div>
            <div>
              <strong>7</strong>
              <span>Orders awaiting picking</span>
            </div>
            <div>
              <strong>3</strong>
              <span>Inventory discrepancies</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
