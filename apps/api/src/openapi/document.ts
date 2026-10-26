import { buildDocument, type Operation } from "./define.js";
import { metaOperations } from "./meta.openapi.js";

const operations: Operation[] = [...metaOperations];

export const openApiDocument = buildDocument(operations, {
  title: "Warehouse Ops API",
  version: "1.0.0",
  description:
    "Generated from the Zod schemas in apps/api (code-first). Run `npm run openapi:generate -w apps/api` after changing an endpoint.",
});
