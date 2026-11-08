import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/**
 * Inboxes that are worked through rather than read.
 *
 * - A type says whether it asks for action, and whether only its app may resolve it.
 * - A notification may be about a subject (`refund:42`). Each person has at most one open item per
 *   subject: a later notification about it moves the item on to the newest message instead of adding
 *   another, so an item is no longer one message.
 * - Items are open, snoozed until a time, or resolved (by the app, or by the person), and are ordered by
 *   a position that every update takes anew.
 * - What an app resolved is also kept per subject, for people who got the notification only by e-mail or
 *   Slack, whose links show it.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    ALTER TABLE notification_types
      ADD COLUMN action boolean NOT NULL DEFAULT false,
      ADD COLUMN resolved_by text NOT NULL DEFAULT 'anyone' CHECK (resolved_by IN ('anyone', 'app'))
  `
  yield* sql`ALTER TABLE messages ADD COLUMN subject text`

  yield* sql`CREATE SEQUENCE inbox_position`
  yield* sql`
    ALTER TABLE inbox
      ADD COLUMN source text,
      ADD COLUMN subject text,
      ADD COLUMN action boolean NOT NULL DEFAULT false,
      ADD COLUMN guarded boolean NOT NULL DEFAULT false,
      ADD COLUMN updates integer NOT NULL DEFAULT 1,
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN position bigint NOT NULL DEFAULT nextval('inbox_position'),
      ADD COLUMN snoozed_until timestamptz,
      ADD COLUMN resolved_at timestamptz,
      ADD COLUMN resolved_via text CHECK (resolved_via IN ('app', 'person')),
      ADD COLUMN resolved_by_id text,
      ADD COLUMN resolved_by_name text
  `
  // Items from before: information, in the order they came.
  yield* sql`
    UPDATE inbox i SET source = m.source, updated_at = i.created_at
    FROM messages m WHERE m.id = i.message_id
  `
  yield* sql`UPDATE inbox SET position = id`
  yield* sql`SELECT setval('inbox_position', (SELECT COALESCE(max(id), 0) + 1 FROM inbox), false)`
  yield* sql`ALTER TABLE inbox ALTER COLUMN source SET NOT NULL`

  yield* sql`DROP INDEX inbox_user_idx`
  yield* sql`DROP INDEX inbox_unread_idx`
  yield* sql`CREATE INDEX inbox_user_idx ON inbox (user_id, position DESC)`
  // The one open item a person has about a subject, which later notifications about it update.
  yield* sql`
    CREATE UNIQUE INDEX inbox_open_subject_idx ON inbox (user_id, source, subject)
    WHERE subject IS NOT NULL AND resolved_at IS NULL
  `
  yield* sql`CREATE INDEX inbox_subject_idx ON inbox (source, subject) WHERE resolved_at IS NULL`
  yield* sql`CREATE INDEX inbox_snoozed_idx ON inbox (snoozed_until) WHERE snoozed_until IS NOT NULL`
  yield* sql`CREATE INDEX inbox_resolved_idx ON inbox (resolved_at) WHERE resolved_at IS NOT NULL`

  yield* sql`
    CREATE TABLE resolutions (
      source text NOT NULL,
      subject text NOT NULL,
      resolved_at timestamptz NOT NULL DEFAULT now(),
      resolved_by_id text,
      resolved_by_name text,
      PRIMARY KEY (source, subject, resolved_at)
    )
  `
})
