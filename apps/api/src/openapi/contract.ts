import { Ajv2020 } from "ajv/dist/2020.js";
import { openApiDocument } from "./document.js";
import { operationKey } from "./define.js";

// Contract-test helper: checks a real response against openapi.json. Used by
// the contract tests only; the API never calls it.

type Json = Record<string, any>;

type InjectedResponse = {
  statusCode: number;
  headers: Record<string, unknown>;
  body: string;
};

const ajv = new Ajv2020({ strict: false, allErrors: true });

// Zod's regexes were dropped from the spec in favour of these formats.
ajv.addFormat("uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
ajv.addFormat("date-time", /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/);

const validators = new Map<string, ReturnType<typeof ajv.compile>>();
const covered = new Set<string>();

const spec = openApiDocument as unknown as Json;

const validatorFor = (key: string, schema: Json) => {
  let validate = validators.get(key);

  if (!validate) {
    // components travels with the schema so "#/components/schemas/Error" resolves.
    validate = ajv.compile({ ...schema, components: spec.components });
    validators.set(key, validate);
  }

  return validate;
};

const mediaType = (header: unknown) =>
  String(header ?? "").split(";")[0]!.trim().toLowerCase();

/**
 * Throws unless the response is documented for this operation: status code,
 * content type, declared headers and body shape. Returns the parsed body
 * (or the raw text for non-JSON responses).
 */
export function expectConformsToSpec(
  response: InjectedResponse,
  method: string,
  path: string,
) {
  const key = operationKey(method, path);
  const operation = spec.paths?.[path]?.[method.toLowerCase()] as Json | undefined;

  if (!operation) {
    throw new Error(`${key} is not in the OpenAPI spec`);
  }

  const documented = operation.responses?.[String(response.statusCode)] as Json | undefined;

  if (!documented) {
    throw new Error(
      `${key} returned ${response.statusCode}, which the spec does not document (documented: ${Object.keys(operation.responses ?? {}).join(", ")}). Body: ${response.body.slice(0, 200)}`,
    );
  }

  covered.add(`${key} ${response.statusCode}`);

  for (const name of Object.keys(documented.headers ?? {})) {
    if (response.headers[name.toLowerCase()] === undefined) {
      throw new Error(`${key} ${response.statusCode}: documented header "${name}" is missing`);
    }
  }

  const content = documented.content as Json | undefined;

  if (!content) {
    if (response.body !== "") {
      throw new Error(`${key} ${response.statusCode}: spec documents no body but one was returned`);
    }

    return undefined;
  }

  const actualType = mediaType(response.headers["content-type"]);
  const schema = content[actualType]?.schema as Json | undefined;

  if (!schema) {
    throw new Error(
      `${key} ${response.statusCode}: content type "${actualType}" is not documented (documented: ${Object.keys(content).join(", ")})`,
    );
  }

  const body: unknown = actualType === "application/json" ? JSON.parse(response.body) : response.body;
  const validate = validatorFor(`${key} ${response.statusCode} ${actualType}`, schema);

  if (!validate(body)) {
    throw new Error(
      `${key} ${response.statusCode} does not match the spec:\n${ajv.errorsText(validate.errors, { separator: "\n" })}\nBody: ${response.body.slice(0, 500)}`,
    );
  }

  return body;
}

/** Operations in the spec for a tag, as "METHOD /path" keys. */
export const operationsForTag = (tag: string) => {
  const keys: string[] = [];

  for (const [path, item] of Object.entries<Json>(spec.paths)) {
    for (const [method, operation] of Object.entries<Json>(item)) {
      if (operation.tags?.includes(tag)) {
        keys.push(operationKey(method, path));
      }
    }
  }

  return keys;
};

/**
 * Lists operations of a tag that no test has checked a response for. A
 * contract suite calls this at the end so a new endpoint cannot ship
 * without a contract test.
 */
export const uncoveredOperations = (tag: string) =>
  operationsForTag(tag).filter(
    (key) => ![...covered].some((entry) => entry.startsWith(`${key} `)),
  );
