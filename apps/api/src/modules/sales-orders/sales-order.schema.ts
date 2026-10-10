import { z } from "zod";

const salesOrderItemSchema = z.object({
  productId: z.uuid(),
  orderedQuantity: z.number().int().positive(),
});

export const createSalesOrderSchema = z.object({
  orderNumber: z.string().trim().min(1).max(100),
  customer: z.string().trim().min(1).max(200),
  items: z.array(salesOrderItemSchema).min(1),
});

export const salesOrderIdSchema = z.object({
  id: z.uuid(),
});

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
