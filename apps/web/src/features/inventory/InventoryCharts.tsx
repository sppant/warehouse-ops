import { memo, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "../../components/ui/Button";
import type { InventorySummary } from "./overview";

type InventoryChartsProps = {
  summary?: InventorySummary;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

const axisTick = { fill: "var(--color-text-muted)", fontSize: 11 };
const tooltipStyle = {
  background: "var(--color-surface-elevated)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: 10,
  color: "var(--color-text)",
  fontSize: 12,
};

type ChartPanelProps = {
  title: string;
  description: string;
  wide?: boolean;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  children: ReactNode;
};

// Every panel has the same fixed chart height in all four states, so loading
// and error never resize the page.
function ChartPanel({
  title,
  description,
  wide,
  isLoading,
  isError,
  isEmpty,
  onRetry,
  children,
}: ChartPanelProps) {
  return (
    <section
      className={`panel inv-chart${wide ? " inv-chart-wide" : ""}`}
      aria-label={title}
    >
      <div className="panel-header">
        <h2>{title}</h2>
        <span className="panel-period">{description}</span>
      </div>

      <div className="inv-chart-body">
        {isError ? (
          <div className="table-state error" role="alert">
            <p>Failed to load chart data.</p>
            <Button type="button" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="inv-skeleton inv-chart-skeleton" aria-busy="true">
            <span className="sr-only">Loading chart…</span>
          </div>
        ) : isEmpty ? (
          <div className="table-state">No data to chart yet.</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

// memo: the charts only depend on the summary, but the page re-renders on every
// page change, filter and keystroke. Re-rendering recharts is slow (tens of
// milliseconds), so skip it unless these props actually change.
export const InventoryCharts = memo(function InventoryCharts({
  summary,
  isLoading,
  isError,
  onRetry,
}: InventoryChartsProps) {
  const shared = { isLoading, isError, onRetry };

  const stockByLocation = (summary?.stockByLocation ?? []).map((row) => ({
    location: row.locationCode,
    available: row.available,
    unavailable: row.onHand - row.available,
  }));

  return (
    <div className="inv-charts">
      <ChartPanel
        {...shared}
        wide
        title="Stock by location"
        description="Top 20 locations by units on hand"
        isEmpty={stockByLocation.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stockByLocation}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="location" tick={axisTick} interval={0} angle={-35} textAnchor="end" height={50} />
            <YAxis tick={axisTick} width={48} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-surface-hover)" }} />
            <Bar dataKey="available" name="Available" stackId="stock" fill="var(--color-accent)" />
            <Bar dataKey="unavailable" name="Reserved or damaged" stackId="stock" fill="var(--color-border-strong)" />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel
        {...shared}
        title="Movements per day"
        description="Last 30 days (UTC)"
        isEmpty={(summary?.movementsPerDay ?? []).every((day) => day.count === 0)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={summary?.movementsPerDay}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="date" tick={axisTick} tickFormatter={(value: string) => value.slice(5)} minTickGap={24} />
            <YAxis tick={axisTick} width={48} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="count" name="Movements" stroke="var(--color-info)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel
        {...shared}
        title="Most active items"
        description="Top 10 by units moved, last 30 days"
        isEmpty={(summary?.topItems ?? []).length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={summary?.topItems} layout="vertical">
            <CartesianGrid stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" tick={axisTick} />
            <YAxis type="category" dataKey="sku" tick={axisTick} width={84} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-surface-hover)" }} />
            <Bar dataKey="volume" name="Units moved" fill="var(--color-success)" />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>
    </div>
  );
});
