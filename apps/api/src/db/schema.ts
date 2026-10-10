import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const stockMovementType = pgEnum("stock_movement_type", [
  "RECEIPT",
  "PICK",
  "DAMAGE",
  "RETURN",
  "ADJUSTMENT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
]);

export const purchaseOrderStatus = pgEnum("purchase_order_status", [
  "DRAFT",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);

export const salesOrderStatus = pgEnum("sales_order_status", [
  "PENDING",
  "ALLOCATED",
  "PICKING",
  "PICKED",
  "PACKED",
  "SHIPPED",
  "CANCELLED",
]);

export const warehouses = pgTable("warehouses", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("warehouses_code_unique").on(table.code),
]);

export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("locations_warehouse_code_unique").on(
    table.warehouseId,
    table.code,
  ),
]);

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  unitCost: numeric("unit_cost", {
    precision: 12,
    scale: 2,
  }).notNull(),
  unitWeightGrams: integer("unit_weight_grams"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("products_sku_unique").on(table.sku),
]);

export const inventory = pgTable("inventory", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  locationId: uuid("location_id")
    .notNull()
    .references(() => locations.id),
  onHand: integer("on_hand").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  damaged: integer("damaged").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("inventory_product_location_unique").on(
    table.productId,
    table.locationId,
  ),
]);

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  locationId: uuid("location_id")
    .notNull()
    .references(() => locations.id),
  type: stockMovementType("type").notNull(),
  quantity: integer("quantity").notNull(),
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});


export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: text("order_number").notNull(),
  supplier: text("supplier").notNull(),
  status: purchaseOrderStatus("status").notNull().default("DRAFT"),
  orderedAt: timestamp("ordered_at", { withTimezone: true }),
  expectedAt: timestamp("expected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("purchase_orders_order_number_unique").on(table.orderNumber),
]);

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  orderedQuantity: integer("ordered_quantity").notNull(),
  receivedQuantity: integer("received_quantity").notNull().default(0),
  unitCost: numeric("unit_cost", {
    precision: 12,
    scale: 2,
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const salesOrders = pgTable("sales_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: text("order_number").notNull(),
  customer: text("customer").notNull(),
  status: salesOrderStatus("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("sales_orders_order_number_unique").on(table.orderNumber),
]);

export const salesOrderItems = pgTable("sales_order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  salesOrderId: uuid("sales_order_id")
    .notNull()
    .references(() => salesOrders.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  orderedQuantity: integer("ordered_quantity").notNull(),
  allocatedQuantity: integer("allocated_quantity").notNull().default(0),
  pickedQuantity: integer("picked_quantity").notNull().default(0),
  shippedQuantity: integer("shipped_quantity").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
