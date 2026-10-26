import { z } from "zod";

// A tiny OpenAPI 3.1 builder. Request shapes come from the Zod schemas the
// routes already validate with; response shapes are Zod schemas written next
// to them (the routes have none), checked against real responses by the
// contract tests.

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export type ResponseDef = {
  description: string;
  schema?: z.ZodType;
  contentType?: string;
  headers?: Record<string, { description: string; schema: z.ZodType }>;
};

export type Operation = {
  method: HttpMethod;
  path: string; // OpenAPI style, e.g. /api/products/{id}
  tag: string;
  summary: string;
  description?: string;
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodType;
  responses: Record<number, ResponseDef>;
};

type Json = Record<string, unknown>;

export const operationKey = (method: string, path: string) =>
  `${method.toUpperCase()} ${path}`;

// Zod emits a long regex next to format: "uuid" / "date-time". The format
// already says it, so the regex is dropped to keep the spec readable.
const FORMATS_WITH_NOISY_PATTERN = new Set(["uuid", "date-time"]);

const clean = (node: unknown): unknown => {
  if (Array.isArray(node)) {
    return node.map(clean);
  }

  if (typeof node !== "object" || node === null) {
    return node;
  }

  const entries = Object.entries(node as Json).filter(
    ([key]) => key !== "$schema",
  );
  const format = (node as Json).format;
  const dropPattern =
    typeof format === "string" && FORMATS_WITH_NOISY_PATTERN.has(format);

  return Object.fromEntries(
    entries
      .filter(([key]) => !(dropPattern && key === "pattern"))
      .map(([key, value]) => [key, clean(value)]),
  );
};

const toJsonSchema = (schema: z.ZodType, io: "input" | "output"): Json =>
  clean(z.toJSONSchema(schema, { io })) as Json;

const parametersFrom = (
  schema: z.ZodObject,
  location: "path" | "query",
): Json[] => {
  const { properties = {}, required = [] } = toJsonSchema(
    schema,
    "input",
  ) as { properties?: Record<string, Json>; required?: string[] };

  return Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    in: location,
    required: location === "path" || required.includes(name),
    schema: propertySchema,
  }));
};

export const errorSchema = z.object({
  error: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

const ERROR_REF = { $ref: "#/components/schemas/Error" };

const buildResponse = ({ description, schema, contentType, headers }: ResponseDef) => {
  const response: Json = { description };

  if (headers) {
    response.headers = Object.fromEntries(
      Object.entries(headers).map(([name, header]) => [
        name,
        { description: header.description, schema: toJsonSchema(header.schema, "output") },
      ]),
    );
  }

  if (schema) {
    response.content = {
      [contentType ?? "application/json"]: {
        schema: schema === errorSchema ? ERROR_REF : toJsonSchema(schema, "output"),
      },
    };
  }

  return response;
};

const buildOperation = (operation: Operation) => {
  const parameters = [
    ...(operation.params ? parametersFrom(operation.params, "path") : []),
    ...(operation.query ? parametersFrom(operation.query, "query") : []),
  ];

  return {
    tags: [operation.tag],
    summary: operation.summary,
    ...(operation.description ? { description: operation.description } : {}),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(operation.body
      ? {
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: toJsonSchema(operation.body, "input") },
            },
          },
        }
      : {}),
    responses: Object.fromEntries(
      Object.entries(operation.responses).map(([status, response]) => [
        status,
        buildResponse(response),
      ]),
    ),
  };
};

export const buildDocument = (operations: Operation[], info: { title: string; version: string; description: string }) => {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const operation of operations) {
    const pathItem = (paths[operation.path] ??= {});

    if (pathItem[operation.method]) {
      throw new Error(`Duplicate operation ${operationKey(operation.method, operation.path)}`);
    }

    pathItem[operation.method] = buildOperation(operation);
  }

  return {
    openapi: "3.1.0",
    info,
    paths,
    components: { schemas: { Error: toJsonSchema(errorSchema, "output") } },
  };
};

export type OpenApiDocument = ReturnType<typeof buildDocument>;
