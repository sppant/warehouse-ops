import { z } from "zod";
import { errorSchema, type ResponseDef } from "./define.js";

export const uuidField = z.uuid();
export const timestampField = z.iso.datetime();

export const dataOf = <T extends z.ZodType>(schema: T) =>
  z.object({ data: schema });

export const listOf = <T extends z.ZodType>(schema: T) =>
  z.object({ data: z.array(schema) });

const errorResponse = (description: string): ResponseDef => ({
  description,
  schema: errorSchema,
});

// Error bodies are always { error: string }; validation failures may add
// details (Zod's flattened errors).
export const badRequest = (description = "Invalid request") => errorResponse(description);
export const notFound = (description = "Not found") => errorResponse(description);
export const conflict = (description = "Conflict") => errorResponse(description);
