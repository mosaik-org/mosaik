import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/**
 * What apps (and Core) tell people beside their names in navigation: the current value of each
 * status, per audience (`user:<id>` or `permission:<key>`). Only current values are kept: a value
 * replaced or cleared is gone, and one that expires (work running) is removed after it does.
 *
 * Manifests stored before then declare statuses: none did.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE statuses (
      owner text NOT NULL,
      name text NOT NULL,
      audience text NOT NULL,
      value jsonb NOT NULL,
      -- Where it leads (under the app's address for an app's); NULL: its page.
      link text,
      expires_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (owner, name, audience)
    )
  `
  yield* sql`CREATE INDEX statuses_expires_at ON statuses (expires_at) WHERE expires_at IS NOT NULL`

  yield* sql`
    UPDATE apps SET manifest = jsonb_build_object('statuses', '[]'::jsonb) || manifest
    WHERE manifest IS NOT NULL
  `
})
