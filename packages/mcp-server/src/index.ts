#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createApiClient } from "./api-client.js";
import { ConfigError, loadConfig } from "./config.js";
import { createServer } from "./server.js";

// stdout carries the MCP protocol, so anything human-readable goes to stderr.
try {
  const config = loadConfig();
  const client = createApiClient(config);

  serveStdio(() => createServer(client));
  console.error(`warehouse-ops MCP server ready (API: ${config.apiUrl})`);
} catch (error) {
  console.error(error instanceof ConfigError ? error.message : "Failed to start MCP server");
  process.exit(1);
}
