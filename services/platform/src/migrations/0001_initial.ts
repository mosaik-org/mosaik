import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/**
 * The platform service's schema (Core).
 *
 * - App identities: configured ones (seeded from configuration, keys derived) and managed
 *   ones (created by the Portal, keys issued), where the gateway reaches them, and the
 *   manifest each registered.
 * - Route change signals for the gateway, and platform events: one ordered log and, per
 *   subscriber (an app or a platform service), how far it has processed it.
 * - Requests for access to apps. User ids there are not foreign keys (users live in the
 *   auth service): rows are removed when a user is deleted (platform event) or an app is.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // --- Apps ----------------------------------------------------------------------------

  yield* sql`
    CREATE TABLE apps (
      id text PRIMARY KEY,
      origin text NOT NULL CHECK (origin IN ('configured', 'managed')),
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
      -- No address while the app is not running.
      upstream text,
      -- Standalone apps: where they serve their own page (sign-in returns only there).
      public_url text,
      -- Managed apps; configured apps' keys are derived from INTERNAL_KEY.
      key_hash text,
      manifest jsonb,
      registered_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `

  // --- Routes and platform events ------------------------------------------------------

  // Any change that can affect routing, however it is made, wakes the gateway's route stream.
  yield* sql`
    CREATE FUNCTION notify_routes() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_notify('mosaik_routes', '');
      RETURN NULL;
    END
    $$
  `
  yield* sql`
    CREATE TRIGGER apps_routes AFTER INSERT OR DELETE OR UPDATE OF upstream, status ON apps
    FOR EACH STATEMENT EXECUTE FUNCTION notify_routes()
  `
  yield* sql`
    CREATE TABLE events (
      seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      id uuid NOT NULL UNIQUE,
      type text NOT NULL,
      occurred_at timestamptz NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT now(),
      data jsonb NOT NULL
    )
  `
  yield* sql`CREATE INDEX events_recorded_at_idx ON events (recorded_at)`
  // Single row: the last position removed by retention, to tell apps they missed events.
  yield* sql`CREATE TABLE event_log (pruned_through bigint NOT NULL)`
  yield* sql`INSERT INTO event_log (pruned_through) VALUES (0)`
  yield* sql`
    CREATE TABLE event_consumers (
      -- An app's id, or service:<name>.
      consumer text PRIMARY KEY,
      position bigint NOT NULL,
      last_error text,
      error_at timestamptz,
      polled_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `

  // --- Access requests -----------------------------------------------------------------

  // `role`: the role asked for; `granted_role`: the one the approval gave (`{ id, name }`, kept as answered).
  yield* sql`
    CREATE TABLE access_requests (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      app_id text NOT NULL,
      app_name text NOT NULL,
      access text NOT NULL,
      user_id text NOT NULL,
      user_name text NOT NULL,
      user_email text NOT NULL,
      role jsonb,
      message text,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
      created_at timestamptz NOT NULL DEFAULT now(),
      decided_at timestamptz,
      decided_by text,
      granted_role jsonb,
      response text
    )
  `
  // One open request per user and app.
  yield* sql`CREATE UNIQUE INDEX access_requests_pending_idx ON access_requests (user_id, app_id) WHERE status = 'pending'`
  yield* sql`CREATE INDEX access_requests_status_idx ON access_requests (status, created_at)`
})
