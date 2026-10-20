import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/**
 * Apps' settings: the values their owners and admins changed from the defaults the manifest
 * declares (a setting without a row has its default), and a version per app that grows with
 * every change, so apps waiting for changes know they have the latest.
 *
 * Manifests stored before then get the fields manifests have since: no settings, and config
 * entries without a label, asked for as text.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`ALTER TABLE apps ADD COLUMN settings_version bigint NOT NULL DEFAULT 0`

  yield* sql`
    CREATE TABLE app_settings (
      app_id text NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      name text NOT NULL,
      value jsonb NOT NULL,
      -- Who changed it (their name when they did), for the people who manage the app.
      changed_by text NOT NULL,
      changed_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (app_id, name)
    )
  `

  yield* sql`
    UPDATE apps SET manifest = jsonb_set(
      jsonb_build_object('settings', '[]'::jsonb) || manifest,
      '{portal,config}',
      COALESCE(
        (
          SELECT jsonb_agg(jsonb_build_object('label', NULL, 'kind', 'text') || setting)
          FROM jsonb_array_elements(manifest -> 'portal' -> 'config') AS setting
        ),
        '[]'::jsonb
      )
    )
    WHERE manifest IS NOT NULL
  `
})
