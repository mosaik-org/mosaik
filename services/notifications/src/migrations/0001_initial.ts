import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/**
 * The notifications service's schema.
 *
 * - Messages and their deliveries (the outbox): a message is what a service sent; each
 *   destination becomes a delivery that the worker sends, retries and records. A
 *   notification is a message with an in-app inbox and per-user channel preferences.
 * - Notification types registered by apps, users' preferences and inboxes.
 * - Admin-managed Teams/Slack targets with routing rules.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE messages (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      source text NOT NULL,
      kind text,
      content jsonb NOT NULL,
      category text NOT NULL DEFAULT 'message' CHECK (category IN ('message', 'notification')),
      idempotency_key text,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (source, idempotency_key)
    )
  `
  yield* sql`CREATE INDEX messages_created_at_idx ON messages (created_at DESC)`

  yield* sql`
    CREATE TABLE deliveries (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      message_id integer NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
      channel text NOT NULL,
      recipient text NOT NULL,
      recipient_name text,
      recipient_user_id text,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
      attempts integer NOT NULL DEFAULT 0,
      next_attempt_at timestamptz NOT NULL DEFAULT now(),
      locked_until timestamptz,
      last_error text,
      provider_id text,
      sent_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (message_id, channel, recipient)
    )
  `
  yield* sql`
    CREATE INDEX deliveries_due_idx ON deliveries (next_attempt_at) WHERE status IN ('pending', 'sending')
  `

  yield* sql`
    CREATE TABLE notification_types (
      key text PRIMARY KEY,
      source text NOT NULL,
      description text NOT NULL,
      default_channels jsonb NOT NULL,
      stale boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `

  yield* sql`
    CREATE TABLE inbox (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      message_id integer NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
      user_id text NOT NULL,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (message_id, user_id)
    )
  `
  yield* sql`CREATE INDEX inbox_user_idx ON inbox (user_id, id DESC)`
  yield* sql`CREATE INDEX inbox_unread_idx ON inbox (user_id) WHERE read_at IS NULL`

  yield* sql`
    CREATE TABLE preferences (
      user_id text NOT NULL,
      type_key text NOT NULL,
      channel text NOT NULL CHECK (channel IN ('inApp', 'email', 'slack')),
      enabled boolean NOT NULL,
      PRIMARY KEY (user_id, type_key, channel)
    )
  `

  yield* sql`
    CREATE TABLE targets (
      id text PRIMARY KEY,
      name text NOT NULL,
      kind text NOT NULL CHECK (kind IN ('slack-webhook', 'slack-channel', 'teams-webhook')),
      config jsonb NOT NULL,
      allowed_sources jsonb NOT NULL DEFAULT '[]',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  yield* sql`
    CREATE TABLE routes (
      key text NOT NULL,
      target_id text NOT NULL REFERENCES targets (id) ON DELETE CASCADE,
      PRIMARY KEY (key, target_id)
    )
  `
})
