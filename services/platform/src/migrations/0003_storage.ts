import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/**
 * Apps' files: the content is in the storage service (SeaweedFS, under `<app>/<key>`), what
 * the platform needs to know here. Their sizes are what each app's limit is checked against:
 * the platform's default, or one an admin set for the app.
 *
 * Manifests stored before then say whether the app stores files: none did.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // NULL: the platform's default (`STORAGE_DEFAULT_LIMIT_GB`).
  yield* sql`ALTER TABLE apps ADD COLUMN storage_limit_bytes bigint CHECK (storage_limit_bytes >= 0)`

  yield* sql`
    CREATE TABLE stored_objects (
      app_id text NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      key text NOT NULL,
      size bigint NOT NULL,
      content_type text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (app_id, key)
    )
  `

  yield* sql`
    UPDATE apps SET manifest = jsonb_build_object('storage', false) || manifest
    WHERE manifest IS NOT NULL
  `
})
