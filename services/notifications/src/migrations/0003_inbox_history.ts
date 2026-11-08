import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/**
 * What an inbox item holds. An item points at its newest message only, so the earlier notifications
 * about its subject (that it was assigned, then due soon, then overdue) could not be shown. Each item
 * now records every message filed into it; an item filed before this keeps only its newest.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE inbox_messages (
      item_id integer NOT NULL REFERENCES inbox (id) ON DELETE CASCADE,
      message_id integer NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
      PRIMARY KEY (item_id, message_id)
    )
  `
  yield* sql`INSERT INTO inbox_messages (item_id, message_id) SELECT id, message_id FROM inbox`
})
