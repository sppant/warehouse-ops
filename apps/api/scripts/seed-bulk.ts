import postgres from "postgres";

// Generates a large, reproducible dataset for measuring query performance.
// It writes straight to the tables with set-based SQL (a million rows through
// the services would take hours), so it is a measurement tool only and refuses
// to run against anything but a database whose name ends in "_perf".
//
//   createdb warehouse_ops_perf
//   DATABASE_URL=postgresql://localhost:5432/warehouse_ops_perf npm run db:migrate
//   DATABASE_URL=postgresql://localhost:5432/warehouse_ops_perf npm run db:seed:bulk

const PRODUCTS = 5_000;
const LOCATIONS = 40;
const LOCATIONS_PER_PRODUCT = 30; // 150,000 inventory rows
const MOVEMENTS_PER_ROW = 10; // about 1.35M stock movements (90% kept)
const HISTORY_DAYS = 90;

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not defined");
if (!new URL(url).pathname.endsWith("_perf")) {
  throw new Error("Refusing to bulk-seed: the database name must end in _perf");
}

const sql = postgres(url, { max: 1, onnotice: () => {} });

const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from inventory`;
if (count > 0) {
  console.log(`Database already has ${count} inventory rows, nothing to do.`);
  await sql.end();
  process.exit(0);
}

const started = Date.now();
await sql`select setseed(0.42)`;

await sql`insert into warehouses (code, name) values ('PERF-01', 'Performance Test Warehouse')`;

await sql`
  insert into locations (warehouse_id, code, name)
  select w.id,
         'L-' || lpad(n::text, 3, '0'),
         'Perf location ' || n
  from warehouses w, generate_series(1, ${LOCATIONS}) n
  where w.code = 'PERF-01'`;

await sql`
  insert into products (sku, name, unit_cost, unit_weight_grams)
  select 'PRF-' || lpad(n::text, 5, '0'),
         (array['Steel','Copper','Plastic','Rubber','Carbon','Alloy','Ceramic','Glass'])[1 + (n % 8)]
           || ' ' ||
         (array['Widget','Bracket','Gasket','Valve','Bearing','Coupling','Flange','Sensor'])[1 + ((n / 8) % 8)]
           || ' ' || n,
         round((random() * 200 + 1)::numeric, 2),
         (random() * 5000)::int
  from generate_series(1, ${PRODUCTS}) n`;

// Each product lives in LOCATIONS_PER_PRODUCT distinct locations.
await sql`
  insert into inventory (product_id, location_id)
  select p.id, l.id
  from (select id, row_number() over (order by sku) as rn from products) p
  join (select id, row_number() over (order by code) as rn from locations) l
    on ((l.rn + p.rn) % ${LOCATIONS}) < ${LOCATIONS_PER_PRODUCT}`;

// Stock levels are set in a separate UPDATE on purpose: random() inside an
// uncorrelated subquery or LATERAL is evaluated once, which would give every
// row the same quantity. About 8% of rows are empty, 15% are fully reserved
// and 10% have damaged units, so every stock status is well populated.
await sql`
  update inventory
  set on_hand = case when random() < 0.08 then 0 else (random() * 400)::int end,
      damaged = case when random() < 0.1 then (random() * 5)::int else 0 end`;
await sql`
  update inventory
  set reserved = case
        when random() < 0.15 then on_hand
        else (on_hand * random() * 0.3)::int
      end`;

await sql`
  insert into stock_movements (product_id, location_id, type, quantity, created_at)
  select i.product_id, i.location_id,
         (array['RECEIPT','PICK','PICK','PICK','RETURN','DAMAGE','ADJUSTMENT','TRANSFER_IN','TRANSFER_OUT'])
           [1 + (random() * 8)::int]::stock_movement_type,
         1 + (random() * 40)::int,
         now() - random() * ${HISTORY_DAYS} * interval '1 day'
  from inventory i, generate_series(1, ${MOVEMENTS_PER_ROW}) g
  where random() < 0.9`;

await sql`analyze`;

const [totals] = await sql<{ inventory: number; distinctOnHand: number; movements: number; products: number; locations: number }[]>`
  select (select count(*) from inventory)::int as inventory,
         (select count(distinct on_hand) from inventory)::int as "distinctOnHand",
         (select count(*) from stock_movements)::int as movements,
         (select count(*) from products)::int as products,
         (select count(*) from locations)::int as locations`;
console.log(`Seeded in ${((Date.now() - started) / 1000).toFixed(1)}s:`, totals);

await sql.end();
