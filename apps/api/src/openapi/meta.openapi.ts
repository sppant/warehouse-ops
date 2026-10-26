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
];
