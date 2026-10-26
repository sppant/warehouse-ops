import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import type { InventoryOverviewQuery } from "./inventory.schema.js";
import {
  inventory,
  locations,
  stockMovements,
  products,
  warehouses,
} from "../../db/schema.js";

// An item is LOW_STOCK when 0 < available <= this many units. There is no
// per-product reorder point in the schema yet, so one threshold fits all.
export const LOW_STOCK_THRESHOLD = 10;

// available = on_hand - reserved - damaged (see docs/domain-model.md).
const AVAILABLE_SQL = sql`(i.on_hand - i.reserved - i.damaged)`;

// db.execute() returns timestamps as Postgres-formatted text, so render them
// as ISO-8601 UTC in SQL; that is the format the API promises its clients.
const isoUtc = (column: ReturnType<typeof sql>) =>
  sql`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

// ORDER BY fragments are picked from this fixed map by a Zod-validated key,
// so no user input is ever interpolated into the SQL text.
const overviewSortColumns = {
  product: sql`p.name`,
  sku: sql`p.sku`,
  location: sql`l.code`,
  onHand: sql`i.on_hand`,
  available: AVAILABLE_SQL,
  status: AVAILABLE_SQL,
  lastMovement: sql`lm.last_movement_at`,
} as const;

// Escape LIKE wildcards so typing "50%" or "A_01" searches for that text.
const likePattern = (term: string) =>
  `%${term.replace(/[\\%_]/g, "\\$&")}%`;

const overviewFilters = (query: InventoryOverviewQuery) => {
  const conditions = [sql`true`];

  if (query.locationId) {
    conditions.push(sql`i.location_id = ${query.locationId}`);
  }

  if (query.status === "OUT_OF_STOCK") {
    conditions.push(sql`${AVAILABLE_SQL} <= 0`);
  } else if (query.status === "LOW_STOCK") {
    conditions.push(
      sql`${AVAILABLE_SQL} > 0 AND ${AVAILABLE_SQL} <= ${LOW_STOCK_THRESHOLD}`,
    );
  } else if (query.status === "IN_STOCK") {
    conditions.push(sql`${AVAILABLE_SQL} > ${LOW_STOCK_THRESHOLD}`);
  }

  if (query.search) {
    const pattern = likePattern(query.search);
    conditions.push(
      sql`(p.sku ILIKE ${pattern} OR p.name ILIKE ${pattern} OR l.code ILIKE ${pattern})`,
    );
  }

  return sql.join(conditions, sql` AND `);
};

export type InventoryOverviewRow = {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  locationId: string;
  locationCode: string;
  warehouseCode: string;
  onHand: number;
  reserved: number;
  damaged: number;
  available: number;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  lastMovementAt: string | null;
  cycleCountFlaggedAt: string | null;
};

// Summary charts cover the last 30 UTC calendar days, today included. Computed
// in SQL from the database clock so the three aggregates share one window.
const SUMMARY_WINDOW_DAYS = 30;
const TOP_ITEMS_LIMIT = 10;
const STOCK_BY_LOCATION_LIMIT = 20;

const WINDOW_START_SQL = sql`
  (date_trunc('day', now() AT TIME ZONE 'UTC') - make_interval(days => ${SUMMARY_WINDOW_DAYS - 1})) AT TIME ZONE 'UTC'
`;

export type StockByLocationRow = {
  locationId: string;
  locationCode: string;
  warehouseCode: string;
  onHand: number;
  available: number;
};

export type MovementsPerDayRow = {
  date: string;
  count: number;
  volume: number;
};

export type TopMovedItemRow = {
  productId: string;
  sku: string;
  productName: string;
  movementCount: number;
  volume: number;
};

export const inventoryRepository = {
  async findStockByLocation() {
    const rows = await db.execute<StockByLocationRow>(sql`
      SELECT
        l.id AS "locationId",
        l.code AS "locationCode",
        w.code AS "warehouseCode",
        sum(i.on_hand)::int AS "onHand",
        sum(i.on_hand - i.reserved - i.damaged)::int AS available
      FROM inventory i
      JOIN locations l ON l.id = i.location_id
      JOIN warehouses w ON w.id = l.warehouse_id
      GROUP BY l.id, l.code, w.code
      ORDER BY "onHand" DESC, l.code
      LIMIT ${STOCK_BY_LOCATION_LIMIT}
    `);

    return Array.from(rows);
  },

  // One row per day even when nothing moved, so the chart has no gaps.
  // volume is units moved regardless of direction: quantities are stored
  // unsigned except ADJUSTMENT, so abs() makes them comparable.
  async findMovementsPerDay() {
    const rows = await db.execute<MovementsPerDayRow>(sql`
      WITH days AS (
        SELECT d::date AS day
        FROM generate_series(
          (${WINDOW_START_SQL} AT TIME ZONE 'UTC')::date,
          (now() AT TIME ZONE 'UTC')::date,
          interval '1 day'
        ) AS d
      ),
      daily AS (
        SELECT
          (m.created_at AT TIME ZONE 'UTC')::date AS day,
          count(*)::int AS count,
          sum(abs(m.quantity))::int AS volume
        FROM stock_movements m
        WHERE m.created_at >= ${WINDOW_START_SQL}
        GROUP BY 1
      )
      SELECT
        to_char(days.day, 'YYYY-MM-DD') AS date,
        coalesce(daily.count, 0) AS count,
        coalesce(daily.volume, 0) AS volume
      FROM days
      LEFT JOIN daily ON daily.day = days.day
      ORDER BY days.day
    `);

    return Array.from(rows);
  },

  async findTopMovedItems() {
    const rows = await db.execute<TopMovedItemRow>(sql`
      SELECT
        p.id AS "productId",
        p.sku,
        p.name AS "productName",
        t.movement_count AS "movementCount",
        t.volume
      FROM (
        SELECT
          m.product_id,
          count(*)::int AS movement_count,
          sum(abs(m.quantity))::int AS volume
        FROM stock_movements m
        WHERE m.created_at >= ${WINDOW_START_SQL}
        GROUP BY m.product_id
        ORDER BY volume DESC
        LIMIT ${TOP_ITEMS_LIMIT}
      ) t
      JOIN products p ON p.id = t.product_id
      ORDER BY t.volume DESC, p.sku
    `);

    return Array.from(rows);
  },

  async findOverviewPage(query: InventoryOverviewQuery) {
    const direction = query.sortDir === "desc" ? sql`DESC` : sql`ASC`;
    const offset = (query.page - 1) * query.pageSize;

    // The lateral subquery asks, per inventory row, for the newest movement of
    // that product at that location. i.id is the tiebreaker so pages never
    // overlap or skip rows when the sort column has duplicates.
    const rows = await db.execute<InventoryOverviewRow>(sql`
      SELECT
        i.id,
        p.id AS "productId",
        p.sku,
        p.name AS "productName",
        l.id AS "locationId",
        l.code AS "locationCode",
        w.code AS "warehouseCode",
        i.on_hand AS "onHand",
        i.reserved,
        i.damaged,
        ${AVAILABLE_SQL} AS available,
        CASE
          WHEN ${AVAILABLE_SQL} <= 0 THEN 'OUT_OF_STOCK'
          WHEN ${AVAILABLE_SQL} <= ${LOW_STOCK_THRESHOLD} THEN 'LOW_STOCK'
          ELSE 'IN_STOCK'
        END AS status,
        ${isoUtc(sql`lm.last_movement_at`)} AS "lastMovementAt",
        ${isoUtc(sql`i.cycle_count_flagged_at`)} AS "cycleCountFlaggedAt"
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      JOIN locations l ON l.id = i.location_id
      JOIN warehouses w ON w.id = l.warehouse_id
      LEFT JOIN LATERAL (
        SELECT max(m.created_at) AS last_movement_at
        FROM stock_movements m
        WHERE m.product_id = i.product_id AND m.location_id = i.location_id
      ) lm ON true
      WHERE ${overviewFilters(query)}
      ORDER BY ${overviewSortColumns[query.sortBy]} ${direction} NULLS LAST, i.id
      LIMIT ${query.pageSize} OFFSET ${offset}
    `);

    return Array.from(rows);
  },

  async countOverview(query: InventoryOverviewQuery) {
    const rows = await db.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      JOIN locations l ON l.id = i.location_id
      WHERE ${overviewFilters(query)}
    `);

    return rows[0]?.total ?? 0;
  },

  async findAll(search?: string) {
    const rows = await db
      .select({
        id: inventory.id,
        productId: products.id,
        sku: products.sku,
        productName: products.name,
        locationId: locations.id,
        locationCode: locations.code,
        locationName: locations.name,
        warehouseId: warehouses.id,
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
        onHand: inventory.onHand,
        reserved: inventory.reserved,
        damaged: inventory.damaged,
        updatedAt: inventory.updatedAt,
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .innerJoin(locations, eq(inventory.locationId, locations.id))
      .innerJoin(warehouses, eq(locations.warehouseId, warehouses.id))
      .where(
        search
          ? or(
              ilike(products.sku, `%${search}%`),
              ilike(products.name, `%${search}%`),
              ilike(locations.code, `%${search}%`),
            )
          : undefined,
      )
      .orderBy(products.name, locations.code);

    return rows;
  },

  // Idempotent: flagging an already flagged row keeps its original timestamp.
  // Deliberately leaves updated_at alone, which records stock changes only.
  async setCycleCountFlag(id: string, flagged: boolean) {
    const updated = await db
      .update(inventory)
      .set({
        cycleCountFlaggedAt: flagged
          ? sql`coalesce(${inventory.cycleCountFlaggedAt}, now())`
          : null,
      })
      .where(eq(inventory.id, id))
      .returning({
        id: inventory.id,
        cycleCountFlaggedAt: inventory.cycleCountFlaggedAt,
      });

    return updated[0];
  },

  async findMovements(productId?: string, locationId?: string) {
    return db
      .select({
        id: stockMovements.id,
        productId: products.id,
        sku: products.sku,
        productName: products.name,
        locationId: locations.id,
        locationCode: locations.code,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        referenceType: stockMovements.referenceType,
        referenceId: stockMovements.referenceId,
        reason: stockMovements.reason,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .innerJoin(locations, eq(stockMovements.locationId, locations.id))
      .where(
        productId && locationId
          ? and(
              eq(stockMovements.productId, productId),
              eq(stockMovements.locationId, locationId),
            )
          : productId
            ? eq(stockMovements.productId, productId)
            : locationId
              ? eq(stockMovements.locationId, locationId)
              : undefined,
      )
      .orderBy(desc(stockMovements.createdAt));
  },

  async receiveStock(
    productId: string,
    locationId: string,
    quantity: number,
    reason?: string,
  ) {
    return db.transaction(async (tx) => {
      const inventoryResult = await tx
        .insert(inventory)
        .values({
          productId,
          locationId,
          onHand: quantity,
        })
        .onConflictDoUpdate({
          target: [inventory.productId, inventory.locationId],
          set: {
            onHand: sql`${inventory.onHand} + ${quantity}`,
            updatedAt: sql`now()`,
          },
        })
        .returning();

      const inventoryRow = inventoryResult[0];

      if (!inventoryRow) {
        throw new Error("Failed to update inventory");
      }

      await tx.insert(stockMovements).values({
        productId,
        locationId,
        type: "RECEIPT",
        quantity,
        reason: reason ?? null,
      });

      return inventoryRow;
    });
  },

  async reserveStock(
    productId: string,
    locationId: string,
    quantity: number,
  ) {
    return db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: inventory.id,
          onHand: inventory.onHand,
          reserved: inventory.reserved,
          damaged: inventory.damaged,
        })
        .from(inventory)
        .where(
          and(
            eq(inventory.productId, productId),
            eq(inventory.locationId, locationId),
          ),
        )
        .for("update");

      const row = rows[0];
      const available = row
        ? row.onHand - row.reserved - row.damaged
        : 0;

      if (available < quantity) {
        throw new Error("Insufficient available inventory");
      }

      const updated = await tx
        .update(inventory)
        .set({
          reserved: sql`${inventory.reserved} + ${quantity}`,
          updatedAt: sql`now()`,
        })
        .where(eq(inventory.id, row!.id))
        .returning();

      return updated[0];
    });
  },

  async releaseStock(
    productId: string,
    locationId: string,
    quantity: number,
  ) {
    return db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: inventory.id,
          reserved: inventory.reserved,
        })
        .from(inventory)
        .where(
          and(
            eq(inventory.productId, productId),
            eq(inventory.locationId, locationId),
          ),
        )
        .for("update");

      const row = rows[0];

      if (!row || row.reserved < quantity) {
        throw new Error("Cannot release more than reserved quantity");
      }

      const updated = await tx
        .update(inventory)
        .set({
          reserved: sql`${inventory.reserved} - ${quantity}`,
          updatedAt: sql`now()`,
        })
        .where(eq(inventory.id, row.id))
        .returning();

      return updated[0];
    });
  },
};
