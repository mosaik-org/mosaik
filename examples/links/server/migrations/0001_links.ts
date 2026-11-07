import { Effect } from "effect"
import { SqlClient } from "effect/sql"

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`
    CREATE TABLE links (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title text NOT NULL,
      url text NOT NULL,
      added_by_id text NOT NULL,
      added_by_name text NOT NULL,
      added_at timestamptz NOT NULL DEFAULT now()
    )
  `
})
