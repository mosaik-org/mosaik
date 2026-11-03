import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/**
 * How many changes each conversation waits for its person to allow, kept when a turn ends: what
 * the assistant tells Core (the `assistant.approvals` status) adds them up per person, without
 * reading every conversation. Conversations from before then wait for nothing until their next turn.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`ALTER TABLE conversations ADD COLUMN waiting_changes integer NOT NULL DEFAULT 0 CHECK (waiting_changes >= 0)`
})
