import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/**
 * The assistant's conversations: each person's own, kept until deleted. Messages are stored in
 * the contract's provider-neutral form (`MessagePart`s), so any model can continue them.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE conversations (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      title text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  yield* sql`CREATE INDEX conversations_user_idx ON conversations (user_id, updated_at DESC)`

  yield* sql`
    CREATE TABLE messages (
      id bigserial PRIMARY KEY,
      conversation_id text NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
      parts jsonb NOT NULL,
      -- The person's page, on their messages.
      context jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
  yield* sql`CREATE INDEX messages_conversation_idx ON messages (conversation_id, id)`
})
