import type { Config } from "./config.js";

// Messages here are shown to the AI model, so they say what went wrong and
// what to try next. They never contain the API token.
export class ApiRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type Query = Record<string, string | number | undefined>;

export type WarehouseApiClient = {
  get<T>(path: string, query?: Query): Promise<T>;
};

type ErrorBody = { error?: unknown; details?: unknown } | null;

const describeBadRequest = (body: ErrorBody) => {
  const message = typeof body?.error === "string" ? body.error : "Invalid request";
  const details = body?.details ? ` Details: ${JSON.stringify(body.details)}` : "";

  return `The API rejected the request (400): ${message}.${details}`;
};

export const createApiClient = (
  config: Config,
  fetchImpl: typeof fetch = fetch,
): WarehouseApiClient => ({
  async get<T>(path: string, query: Query = {}) {
    const url = new URL(config.apiUrl + path);

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = { Accept: "application/json" };

    if (config.apiToken) {
      headers.Authorization = `Bearer ${config.apiToken}`;
    }

    let response: Response;

    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new ApiRequestError(
          `The Warehouse Ops API did not answer within ${config.timeoutMs} ms. Try again, or narrow the request.`,
        );
      }

      throw new ApiRequestError(
        `Could not reach the Warehouse Ops API at ${config.apiUrl}. Check that it is running and that WAREHOUSE_API_URL is correct.`,
      );
    }

    const body = (await response.json().catch(() => null)) as ErrorBody;

    if (response.status === 401 || response.status === 403) {
      throw new ApiRequestError(
        `The API refused access (${response.status}). Check WAREHOUSE_API_TOKEN.`,
      );
    }

    if (response.status === 400) {
      throw new ApiRequestError(describeBadRequest(body));
    }

    if (response.status === 404) {
      throw new ApiRequestError(
        `Not found (404)${typeof body?.error === "string" ? `: ${body.error}` : ""}.`,
      );
    }

    if (!response.ok) {
      throw new ApiRequestError(
        `The API returned an error (${response.status}). Try again later.`,
      );
    }

    if (body === null) {
      throw new ApiRequestError("The API returned a response that is not valid JSON.");
    }

    return body as T;
  },
});
