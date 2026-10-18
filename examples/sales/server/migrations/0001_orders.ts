import { Effect } from "effect"
import { SqlClient } from "effect/sql"

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`
    CREATE TABLE orders (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      number text NOT NULL UNIQUE,
      customer text NOT NULL,
      email text NOT NULL,
      region text NOT NULL,
      status text NOT NULL,
      amount_cents integer NOT NULL CHECK (amount_cents >= 0),
      refund_reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  yield* sql`CREATE INDEX orders_created_at_idx ON orders (created_at DESC)`
  yield* sql`CREATE INDEX orders_status_idx ON orders (status)`
})
