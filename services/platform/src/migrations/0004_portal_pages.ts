import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/** Manifests stored before then list the app's pages for navigation (`portal.pages`): none did. */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`
    UPDATE apps
    SET manifest = jsonb_set(manifest, '{portal}', jsonb_build_object('pages', '[]'::jsonb) || (manifest -> 'portal'))
    WHERE manifest IS NOT NULL
  `
})
