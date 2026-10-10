import { z } from "zod";

export const pickTaskIdSchema = z.object({
  id: z.uuid(),
});

export const generatePickTaskSchema = z.object({
  salesOrderId: z.uuid(),
});

export type GeneratePickTaskInput = z.infer<typeof generatePickTaskSchema>;
