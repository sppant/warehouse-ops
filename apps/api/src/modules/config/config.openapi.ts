import { z } from "zod";
import type { Operation } from "../../openapi/define.js";
import { dataOf } from "../../openapi/common.js";

export const configOperations: Operation[] = [
  {
    method: "get",
    path: "/api/config/flags",
    tag: "Config",
    summary: "Feature flags",
    description:
      "Which feature flags are on in this environment. All flags default to off. The web app uses this to show or hide features.",
    responses: {
      200: {
        description: "Flag states",
        schema: dataOf(
          z.object({
            movementsCsvExport: z
              .boolean()
              .describe("Enables GET /api/items/{sku}/movements.csv and the Export CSV button."),
          }),
        ),
      },
    },
  },
];
