import { z } from "zod";

export const inventoryQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
});

export const receiveStockSchema = z.object({
  productId: z.uuid(),
  locationId: z.uuid(),
  quantity: z.number().int().positive(),
  reason: z.string().trim().max(500).optional(),
});

export const inventoryMovementsQuerySchema = z.object({
  productId: z.uuid().optional(),
  locationId: z.uuid().optional(),
});

export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;
export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;
export type InventoryMovementsQuery = z.infer<typeof inventoryMovementsQuerySchema>;
