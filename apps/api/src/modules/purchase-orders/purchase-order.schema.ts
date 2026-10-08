import { z } from "zod";

const purchaseOrderStatus = z.enum([
  "DRAFT",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);

const purchaseOrderItemSchema = z.object({
  productId: z.uuid(),
  orderedQuantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
});

export const createPurchaseOrderSchema = z.object({
  orderNumber: z.string().trim().min(1).max(100),
  supplier: z.string().trim().min(1).max(200),
  expectedAt: z.iso.datetime().optional(),
  items: z.array(purchaseOrderItemSchema).min(1),
});

export const purchaseOrderIdSchema = z.object({
  id: z.uuid(),
});

export const updatePurchaseOrderStatusSchema = z.object({
  status: purchaseOrderStatus,
});

export type CreatePurchaseOrderInput = z.infer<
  typeof createPurchaseOrderSchema
>;

export type UpdatePurchaseOrderStatusInput = z.infer<
  typeof updatePurchaseOrderStatusSchema
>;


export const receivePurchaseOrderItemSchema = z.object({
  locationId: z.uuid(),
  quantity: z.number().int().positive(),
  reason: z.string().trim().max(500).optional(),
});

export type ReceivePurchaseOrderItemInput = z.infer<
  typeof receivePurchaseOrderItemSchema
> & {
  purchaseOrderItemId: string;
};
