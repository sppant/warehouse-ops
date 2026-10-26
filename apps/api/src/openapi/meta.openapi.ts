import { z } from "zod";
import type { Operation } from "./define.js";

export const metaOperations: Operation[] = [
  {
    method: "get",
    path: "/health",
    tag: "Meta",
    summary: "Liveness check",
    responses: {
      200: {
        description: "The API is up",
        schema: z.object({ status: z.literal("ok") }),
      },
    },
  },
  {
    method: "get",
    path: "/api/openapi.json",
    tag: "Meta",
    summary: "This OpenAPI document",
    description: "Generated from the code; the same content is committed as apps/api/openapi.json.",
    responses: {
      200: {
        description: "The OpenAPI 3.1 document",
        schema: z.looseObject({ openapi: z.string() }),
      },
    },
  },
];
