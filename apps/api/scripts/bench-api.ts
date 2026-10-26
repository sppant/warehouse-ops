import { sql } from "drizzle-orm";
import { buildApp } from "../src/app.js";
import { db } from "../src/db/index.js";

// Measures the inventory endpoints against a large dataset (see seed-bulk.ts).
//
//   npm run bench:api                  response times over real HTTP (loopback)
//   npm run bench:api -- --explain     EXPLAIN (ANALYZE, BUFFERS) of the exact SQL the app runs
//                                      (add --no-analyze for plain EXPLAIN without executing)
//
// Timings are warm-cache: each scenario runs once untimed, then RUNS times.
// A scenario that fails (for example hitting the database's statement_timeout)
// is reported as FAILED with how long it ran, instead of being retried.

const RUNS = 20;
const analyze = !process.argv.includes("--no-analyze");

const scenarios: Array<[name: string, path: string]> = [
  ["overview: default (sort product, page 1)", "/api/inventory/overview"],
  ["overview: deep page (page 2000)", "/api/inventory/overview?page=2000"],
  ["overview: location + sort available desc", "/api/inventory/overview?locationId={LOC}&sortBy=available&sortDir=desc"],
  ["overview: status=LOW_STOCK", "/api/inventory/overview?status=LOW_STOCK"],
  ["overview: search 'steel widget'", "/api/inventory/overview?search=steel%20widget"],
  ["overview: sort lastMovement desc", "/api/inventory/overview?sortBy=lastMovement&sortDir=desc"],
  ["overview: location + status + search", "/api/inventory/overview?locationId={LOC}&status=IN_STOCK&search=valve"],
  ["summary", "/api/inventory/summary"],
];

const app = buildApp();
const explain = process.argv.includes("--explain");

const [{ id: locationId }] = (await db.execute<{ id: string }>(
  sql`select id from locations order by code limit 1 offset 7`,
)) as unknown as Array<{ id: string }>;
const resolve = (path: string) => path.replace("{LOC}", locationId!);

if (explain) {
  const execute = db.execute.bind(db);
  (db as unknown as { execute: typeof db.execute }).execute = (async (query: Parameters<typeof db.execute>[0]) => {
    const options = analyze ? sql`ANALYZE, BUFFERS` : sql`COSTS`;
    try {
      const plan = await execute<{ "QUERY PLAN": string }>(sql`EXPLAIN (${options}) ${query}`);
      console.log(Array.from(plan).map((row) => row["QUERY PLAN"]).join("\n"), "\n");
    } catch (error) {
      console.log(`EXPLAIN failed: ${(error as Error).message}\n`);
    }
    return execute(query);
  }) as typeof db.execute;

  for (const [name, path] of scenarios) {
    console.log(`=== ${name}\n`);
    // Only the EXPLAIN output matters here; running the real query as well
    // would double the wait for slow scenarios, so it is cut short.
    await app.inject({ method: "GET", url: resolve(path) }).catch(() => undefined);
  }
} else {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  const rows: Record<string, string>[] = [];

  for (const [name, path] of scenarios) {
    const url = base + resolve(path);
    const warmupStart = performance.now();
    const warmup = await fetch(url);
    await warmup.arrayBuffer();
    if (!warmup.ok) {
      rows.push({
        scenario: name,
        "median ms": `FAILED (${warmup.status}) after ${(performance.now() - warmupStart).toFixed(0)}`,
        "p95 ms": "-",
        "max ms": "-",
        "body KB": "-",
      });
      continue;
    }

    const times: number[] = [];
    let bytes = 0;
    for (let run = 0; run < RUNS; run++) {
      const start = performance.now();
      const response = await fetch(url);
      bytes = (await response.arrayBuffer()).byteLength;
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const at = (p: number) => times[Math.min(times.length - 1, Math.ceil(p * times.length) - 1)]!;
    rows.push({
      scenario: name,
      "median ms": at(0.5).toFixed(1),
      "p95 ms": at(0.95).toFixed(1),
      "max ms": at(1).toFixed(1),
      "body KB": (bytes / 1024).toFixed(1),
    });
  }

  console.table(rows);
}

await app.close();
process.exit(0);
