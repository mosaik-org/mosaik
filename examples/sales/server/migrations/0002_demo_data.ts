import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/** Demo data so the example app has something to show. Delete for real apps. */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`
    INSERT INTO orders (number, customer, email, region, status, amount_cents, created_at)
    SELECT
      'SO-' || (10000 + n),
      c.name,
      lower(replace(c.name, ' ', '.')) || '@example.com',
      (ARRAY['EMEA', 'NA', 'LATAM', 'APAC'])[1 + (n % 4)],
      CASE
        WHEN n % 23 = 0 THEN 'refunded'
        WHEN n % 17 = 0 THEN 'cancelled'
        WHEN created < now() - interval '3 days' THEN 'shipped'
        WHEN n % 3 = 0 THEN 'pending'
        ELSE 'paid'
      END,
      (1500 + (random() * 48500))::int,
      created
    FROM generate_series(1, 2400) AS n
    -- Referencing n makes the subquery correlated, so random() runs once per row.
    CROSS JOIN LATERAL (
      SELECT now() - (random() * interval '120 days') - (n * interval '0 seconds') AS created
    ) t
    CROSS JOIN LATERAL (
      SELECT (ARRAY['Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark Industries', 'Wayne Enterprises',
                    'Wonka Industries', 'Tyrell Corp', 'Cyberdyne', 'Soylent', 'Vandelay Industries'])[1 + (n * 7 % 12)] AS name
    ) c
  `
})
