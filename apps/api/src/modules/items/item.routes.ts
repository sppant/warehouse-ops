import type { FastifyInstance } from "fastify";
import { itemMovementsCsvQuerySchema, itemSkuParamSchema } from "./item.schema.js";
import { ItemNotFoundError, itemService } from "./item.service.js";

// Only registered when the movementsCsvExport flag is on (see app.ts), so
// with the flag off this path does not exist and Fastify answers 404.
export async function itemRoutes(app: FastifyInstance) {
  app.get("/api/items/:sku/movements.csv", async (request, reply) => {
    const params = itemSkuParamSchema.safeParse(request.params);
    const query = itemMovementsCsvQuerySchema.safeParse(request.query);

    if (!params.success || !query.success) {
      return reply.status(400).send({
        error: "Invalid movements export request",
        details: {
          params: params.success ? undefined : params.error.flatten(),
          query: query.success ? undefined : query.error.flatten(),
        },
      });
    }

    try {
      const csv = await itemService.movementsCsv(params.data.sku, query.data.locationId);
      // The SKU is user text, so keep the file name to safe characters.
      const fileName = params.data.sku.replace(/[^A-Za-z0-9._-]/g, "_");

      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="movements-${fileName}.csv"`)
        .send(csv);
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        return reply.status(404).send({ error: error.message });
      }

      throw error;
    }
  });
}
