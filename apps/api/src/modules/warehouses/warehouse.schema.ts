import { z } from "zod";

export const createWarehouseSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
});

export const createLocationSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
});

export const warehouseIdSchema = z.object({
  id: z.uuid(),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
