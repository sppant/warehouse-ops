# Warehouse Operations Domain Model

## Goal

The system manages the physical flow of goods through a warehouse.

Core workflow:

Purchase Order -> Receiving -> Storage -> Inventory -> Picking -> Packing -> Shipping

The system must answer:

- How many units do we have?
- Where are they?
- How many are available?
- How many are reserved?
- What has arrived?
- What needs to be picked?
- What has been shipped?
- Where do inventory discrepancies exist?

## Core Entities

### Product

Represents a sellable or stored item.

Important fields:

- SKU
- name
- description
- unit cost
- unit weight
- active status

A SKU is unique.

### Warehouse

Represents a physical warehouse.

A warehouse contains many locations.

### Location

Represents a physical storage location inside a warehouse.

Examples:

- A-01-01
- A-01-02
- B-03-04

A location belongs to exactly one warehouse.

### Inventory

Represents the current stock position of a product at a location.

Tracks:

- on hand
- reserved
- damaged

Conceptually:

available = onHand - reserved - damaged

A product can exist in multiple locations.

A location can contain multiple products.

### Stock Movement

Every inventory change is recorded as a stock movement.

Examples:

- RECEIPT +50
- PICK -3
- DAMAGE -1
- RETURN +2
- ADJUSTMENT -5
- TRANSFER_OUT -10
- TRANSFER_IN +10

Stock movements provide the audit trail for inventory changes.

## Purchasing and Receiving

### PurchaseOrder

Represents an order placed with a supplier.

States:

- DRAFT
- ORDERED
- PARTIALLY_RECEIVED
- RECEIVED
- CANCELLED

### PurchaseOrderItem

Represents a product and quantity requested on a purchase order.

Tracks:

- ordered quantity
- received quantity

### Receiving

Represents a physical receiving operation associated with a purchase order.

### ReceivingItem

Represents the actual quantity received for a product.

Receiving creates stock movements.

## Customer Orders

### SalesOrder

Represents an order that needs to be fulfilled.

States:

- PENDING
- ALLOCATED
- PICKING
- PICKED
- PACKED
- SHIPPED
- CANCELLED

### SalesOrderItem

Represents a product and requested quantity.

Tracks:

- ordered quantity
- allocated quantity
- picked quantity
- shipped quantity

## Picking

### PickTask

Represents work that needs to be performed by a warehouse operator.

A pick task is generated from a sales order.

The task should order locations efficiently.

### PickTaskItem

Represents the product and quantity to pick from a specific location.

Picking creates stock movements.

Before picking, the system must verify sufficient available inventory.

## Cycle Counting

### CycleCount

Represents a physical inventory count.

Example:

Expected: 72
Counted: 69
Difference: -3

A cycle count records:

- location
- product
- expected quantity
- counted quantity
- difference
- reason
- status
- timestamp

Approved discrepancies create adjustment stock movements.

## Important Invariants

### No negative available inventory

available must be greater than or equal to the requested pick quantity.

### Reserved inventory cannot exceed on-hand inventory

reserved <= onHand

### Every inventory change has an audit trail

Inventory-changing operations must create a corresponding stock movement.

### Receiving cannot exceed the remaining purchase order quantity

Unless explicitly recorded as an over-receipt.

### Picking cannot exceed the allocated quantity

A pick operation must respect the sales order allocation.

### Inventory is location-specific

Example:

Product A

A-01-01 -> 40
A-01-02 -> 25
B-02-01 -> 10

Total -> 75

## Concurrency

Inventory operations must be safe when multiple users operate simultaneously.

Example:

Available stock = 5

User A tries to pick 5.
User B tries to pick 5.

The database transaction must ensure that both operations cannot successfully consume the same 5 units.

The inventory update and stock movement creation must happen atomically.

## Architecture

The application is a modular monolith.

apps/api/src/modules/

- products
- warehouses
- inventory
- purchase-orders (purchasing and receiving — receiving is a transaction on a purchase order's items, not a separate domain concept)
- sales-orders (orders, plus the packing and shipping status transitions)
- picking
- cycle-counts

We avoid microservices.

The goal is a well-structured application, not unnecessary infrastructure.

Two deliberate deviations from a one-module-per-noun split, both because the "extra" concept is a transaction against an existing aggregate rather than an independent entity with its own lifecycle:

- Receiving has no module of its own. It lives in `purchase-orders` because receiving an item only makes sense in the context of a purchase order and directly updates that order's item quantities and status.
- Shipping has no module of its own. It lives in `sales-orders` as the `PACKED -> SHIPPED` transition, since shipping is a terminal status change on the sales order rather than an entity with its own table.
