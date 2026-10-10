import { z } from "zod";

export const cycleCountIdSchema = z.object({
  id: z.uuid(),
});

export const recordCycleCountSchema = z.object({
  productId: z.uuid(),
  locationId: z.uuid(),
  countedQuantity: z.number().int().nonnegative(),
  reason: z.string().trim().max(500).optional(),
});

export type RecordCycleCountInput = z.infer<typeof recordCycleCountSchema>;
