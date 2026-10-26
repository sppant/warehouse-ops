# Warehouse Ops MCP server

A small [Model Context Protocol](https://modelcontextprotocol.io) server that lets an AI client (Claude Desktop, Claude Code, ...) **read** warehouse data: find items, check stock, list low stock and look at recent stock movements. It talks to the existing Warehouse Ops HTTP API and never touches the database.

It runs locally over **stdio**: the AI client starts it as a child process. It is not deployed anywhere.

## Tools

All four are read-only (`readOnlyHint`), validate their input with Zod, and return structured output.

| Tool | What it answers | Calls |
| --- | --- | --- |
| `search_items` | Which items match this text (SKU, name or location code), optionally at one location? | `GET /api/inventory/overview` |
| `get_stock_level` | How much of this exact SKU do we have, in total and per location? | `GET /api/inventory/overview` |
| `list_low_stock` | Which rows have available stock at or below a threshold (default 10)? | `GET /api/inventory/overview` |
| `get_item_movements` | What were the most recent stock movements for this SKU (default 20, max 100)? | `GET /api/products`, `GET /api/inventory/movements` |

API problems (API down, 400, 404, 5xx, timeout) come back as tool errors with a message the model can act on. They never crash the server.

## Build and run

Requires Node.js 20+.

```bash
npm install                                  # from the repo root
npm run build -w packages/mcp-server
npm run dev:api                              # the API must be running (default http://localhost:3001)
node packages/mcp-server/dist/index.js       # waits for an MCP client on stdin
```

Configuration (environment variables):

| Variable | Default | Meaning |
| --- | --- | --- |
| `WAREHOUSE_API_URL` | `http://localhost:3001` | Base URL of the Warehouse Ops API |
| `WAREHOUSE_API_TOKEN` | (none) | Sent as `Authorization: Bearer <token>` when set. See "Authentication" below |
| `WAREHOUSE_API_TIMEOUT_MS` | `10000` | Per-request timeout (100 to 120000) |

## Client configuration

Use the **absolute path** to `dist/index.js` (run `pwd` in `packages/mcp-server` to find it).

### Claude Code

```bash
claude mcp add warehouse-ops \
  -e WAREHOUSE_API_URL=http://localhost:3001 \
  -e WAREHOUSE_API_TOKEN=<your-token> \
  -- node /absolute/path/to/warehouse-ops/packages/mcp-server/dist/index.js
```

### Claude Desktop

Add to `claude_desktop_config.json` (Settings > Developer > Edit Config), then restart the app:

```json
{
  "mcpServers": {
    "warehouse-ops": {
      "command": "node",
      "args": ["/absolute/path/to/warehouse-ops/packages/mcp-server/dist/index.js"],
      "env": {
        "WAREHOUSE_API_URL": "http://localhost:3001",
        "WAREHOUSE_API_TOKEN": "<your-token>"
      }
    }
  }
}
```

`WAREHOUSE_API_TOKEN` can be left out while the API has no auth.

## Example prompts

- "Which items are low on stock?"
- "Which items are low on stock, counting anything with 25 or fewer available?"
- "How much BLT-2001 do we have, and where is it?"
- "Show recent movements for BLT-2001."
- "Search for helmets and tell me which location holds the most."
- "Is anything completely out of stock?" (uses `includeOutOfStock`)

## Testing

```bash
npm test -w packages/mcp-server      # unit tests: each tool with valid input, invalid input and an API error
npm run build -w packages/mcp-server
npm run smoke -w packages/mcp-server # Inspector smoke check, see below
```

The smoke check starts a tiny fake API (`scripts/fake-api.mjs`), then uses the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) CLI (fetched with `npx`, not a project dependency) to confirm the built server lists its four tools and answers calls, including a tool error and a rejected input. To poke at it by hand with the Inspector UI:

```bash
npx @modelcontextprotocol/inspector -e WAREHOUSE_API_URL=http://localhost:3001 node packages/mcp-server/dist/index.js
```

The Inspector does not forward your shell's environment to the server, so pass variables with `-e`.

## Authentication

**The API currently has no authentication**, so there is no read-only token to create. Any client that can reach the API can use every endpoint, including the write ones.

What the MCP server does today: if `WAREHOUSE_API_TOKEN` is set, it sends it as a Bearer token on every request. The API ignores it. The token is read once from the environment, is never logged and never appears in tool output or error messages (a test covers the error path).

The smallest change that would make a real read-only token possible: an opt-in Fastify `onRequest` hook in the API that, when an env var such as `API_READ_TOKEN` is set, allows only `GET`/`HEAD` requests carrying that token and answers 401/403 otherwise. When the variable is unset, behaviour is unchanged. This is not implemented. Until then, point `WAREHOUSE_API_URL` only at an API you trust the AI client to read from.

## Design decisions

- **Read-only.** Every tool maps to a `GET` endpoint. An AI model can be wrong or be steered by text in the data it reads, so the safe default is that it cannot change stock.
- **stdio, not HTTP.** The client launches the process and talks over stdin/stdout, so there is nothing to host, no port to expose and no network auth to design. The trade-off: one user, one machine.
- **Auth.** Credentials come from an environment variable set in the client config, never from tool arguments (the model cannot see or change them). See "Authentication" for the gap in the API.
- **Input validation.** Each tool has a Zod schema with limits (SKU 1-100 chars, query max 200, row limits capped at 50-100, UUIDs checked). The SDK rejects bad arguments before the handler runs, and the schema is also what the model sees in `tools/list`.
- **Errors are tool results.** API failures return `isError: true` with a plain-language message so the model can retry or tell the user. stdout carries the protocol, so logs go to stderr only.
- **Limits worth knowing.** The API has no movement limit, so `get_item_movements` fetches the full history for the SKU and trims it here. "Low stock" below the API's fixed 10-unit status is paged and filtered here.
- **A write tool (for example receive stock) would need:** an explicit user confirmation step (the SDK supports elicitation), a separate write-scoped credential with least privilege, idempotency keys so retries do not double-post, and an audit trail recording who or what acted, with which arguments. None of that exists yet, which is why there are no write tools.

## Demo

<!-- TODO: add a screenshot or short GIF of an AI client using these tools,
     e.g. docs/screenshots/mcp-low-stock.gif, and embed it here. -->

_Screenshot or GIF to be added._
