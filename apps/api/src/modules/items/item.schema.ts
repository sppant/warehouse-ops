import { z } from "zod";

export const itemSkuParamSchema = z.object({
  sku: z.string().trim().min(1).max(100),
});

export const itemMovementsCsvQuerySchema = z.object({
  locationId: z.uuid().optional(),
});

export type ItemMovementsCsvQuery = z.infer<typeof itemMovementsCsvQuerySchema>;
