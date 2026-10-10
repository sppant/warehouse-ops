import { z } from "zod";

export const pickTaskIdSchema = z.object({
  id: z.uuid(),
});

export const generatePickTaskSchema = z.object({
  salesOrderId: z.uuid(),
});

export type GeneratePickTaskInput = z.infer<typeof generatePickTaskSchema>;

export const pickTaskItemIdSchema = z.object({
  itemId: z.uuid(),
});

export const pickItemSchema = z.object({
  quantity: z.number().int().positive(),
  reason: z.string().trim().max(500).optional(),
});

export type PickItemInput = z.infer<typeof pickItemSchema> & {
  pickTaskItemId: string;
};
