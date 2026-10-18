import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/**
 * The auth service's schema. Runs after Better Auth's own migrations (which create
 * `"user"`, `session`, `account`, ...).
 *
 * - The registry: apps, the permissions they declare, and roles with their grants.
 * - The audit log and the token signing keys.
 * - The event outbox: platform events about users, recorded by triggers in the same
 *   transaction as the change, until the relay hands them to the platform.
 * - Access signals on `mosaik_access`: whose access just changed, for the gateway's token
 *   cache and open browsers (see `AccessFeed`).
 * - Sign-in for standalone apps (OAuth): one-time codes, and refresh tokens that last as long
 *   as the Core session they were issued in.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // --- Registry ------------------------------------------------------------------------

  yield* sql`
    CREATE TABLE apps (
      id text PRIMARY KEY,
      name text NOT NULL,
      description text,
      access text NOT NULL,
      registered_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  yield* sql`
    CREATE TABLE permissions (
      key text PRIMARY KEY,
      app_id text NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      description text NOT NULL,
      dangerous boolean NOT NULL DEFAULT false,
      stale boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
  // Apps declare their own roles (`sales:editor`), kept in step by the registry; admins create
  // the others (`app_id` null). A role an app stops declaring is `stale`: it keeps its grants
  // and holders until an admin deletes it.
  yield* sql`
    CREATE TABLE roles (
      id text PRIMARY KEY,
      name text NOT NULL,
      description text,
      built_in boolean NOT NULL DEFAULT false,
      app_id text REFERENCES apps (id) ON DELETE CASCADE,
      position integer NOT NULL DEFAULT 0,
      stale boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
  yield* sql`CREATE INDEX roles_app_idx ON roles (app_id)`
  yield* sql`
    CREATE TABLE role_grants (
      role_id text NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
      grant_key text NOT NULL,
      PRIMARY KEY (role_id, grant_key)
    )
  `
  yield* sql`
    CREATE TABLE user_roles (
      user_id text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
      role_id text NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    )
  `
  yield* sql`
    INSERT INTO roles (id, name, description, built_in) VALUES
      ('anonymous', 'Anonymous', 'Everyone, including visitors that are not logged in', true),
      ('authenticated', 'Authenticated', 'Every logged-in user', true),
      ('superadmin', 'Super admin', 'Full access to every app', true)
  `
  yield* sql`INSERT INTO role_grants (role_id, grant_key) VALUES ('superadmin', '*')`

  // --- Audit log and signing keys ------------------------------------------------------

  yield* sql`
    CREATE TABLE audit_log (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      at timestamptz NOT NULL DEFAULT now(),
      app text NOT NULL,
      action text NOT NULL,
      target text,
      actor_id text,
      actor_email text,
      details jsonb NOT NULL DEFAULT '{}'
    )
  `
  yield* sql`CREATE INDEX audit_log_app_idx ON audit_log (app, id DESC)`
  yield* sql`
    CREATE TABLE signing_keys (
      kid text PRIMARY KEY,
      private_jwk jsonb NOT NULL,
      public_jwk jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `

  // --- Event outbox --------------------------------------------------------------------
  // Recorded whichever way a change is made (admin panel, Better Auth, SSO sign-up). Access
  // changes carry only the user: the relay reads their grants when it hands them over.

  yield* sql`
    CREATE TABLE event_outbox (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      event_id uuid NOT NULL DEFAULT gen_random_uuid(),
      type text NOT NULL,
      user_id text NOT NULL,
      data jsonb NOT NULL DEFAULT '{}',
      occurred_at timestamptz NOT NULL DEFAULT now()
    )
  `
  yield* sql`
    CREATE FUNCTION outbox_user() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        INSERT INTO event_outbox (type, user_id, data) VALUES ('user.created', NEW.id, jsonb_build_object(
          'user', jsonb_build_object('id', NEW.id, 'email', NEW.email, 'name', NEW.name, 'image', NEW.image)));
      ELSE
        INSERT INTO event_outbox (type, user_id, data)
        VALUES ('user.deleted', OLD.id, jsonb_build_object('userId', OLD.id));
      END IF;
      PERFORM pg_notify('mosaik_event_outbox', '');
      RETURN NULL;
    END
    $$
  `
  yield* sql`CREATE TRIGGER user_events AFTER INSERT OR DELETE ON "user" FOR EACH ROW EXECUTE FUNCTION outbox_user()`

  // Role assignments, once per statement and user. Users being deleted are left out:
  // their role rows go with them, and they get `user.deleted`.
  yield* sql`
    CREATE FUNCTION outbox_user_roles() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO event_outbox (type, user_id)
      SELECT DISTINCT 'user.access_changed', changed.user_id FROM changed
      WHERE EXISTS (SELECT 1 FROM "user" u WHERE u.id = changed.user_id);
      PERFORM pg_notify('mosaik_event_outbox', '');
      RETURN NULL;
    END
    $$
  `
  // A role's grants: every user holding the role, or everyone for the implicit roles.
  yield* sql`
    CREATE FUNCTION outbox_role_grants() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM changed WHERE role_id IN ('anonymous', 'authenticated')) THEN
        INSERT INTO event_outbox (type, user_id) SELECT 'user.access_changed', u.id FROM "user" u;
      ELSE
        INSERT INTO event_outbox (type, user_id)
        SELECT DISTINCT 'user.access_changed', ur.user_id FROM user_roles ur
        WHERE ur.role_id IN (SELECT role_id FROM changed);
      END IF;
      PERFORM pg_notify('mosaik_event_outbox', '');
      RETURN NULL;
    END
    $$
  `

  // --- Access signals ------------------------------------------------------------------
  // A user's id when their roles change or one of their sessions ends (sign-out, deletion);
  // `*` when a role's grants change (often many people at once). Unlike the outbox nothing
  // is kept: listeners that missed signals start over.

  yield* sql.unsafe(`
    CREATE FUNCTION signal_role_holders() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE holder text;
    BEGIN
      FOR holder IN SELECT DISTINCT user_id FROM changed LOOP
        PERFORM pg_notify('mosaik_access', holder);
      END LOOP;
      RETURN NULL;
    END
    $$
  `)
  yield* sql.unsafe(`
    CREATE FUNCTION signal_ended_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE holder text;
    BEGIN
      FOR holder IN SELECT DISTINCT "userId" FROM changed LOOP
        PERFORM pg_notify('mosaik_access', holder);
      END LOOP;
      RETURN NULL;
    END
    $$
  `)
  yield* sql.unsafe(`
    CREATE FUNCTION signal_grants() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM changed) THEN
        PERFORM pg_notify('mosaik_access', '*');
      END IF;
      RETURN NULL;
    END
    $$
  `)

  // A trigger with a transition table handles one kind of change, hence one per table and kind.
  for (const [table, op, fn] of [
    ["user_roles", "INSERT", "outbox_user_roles"],
    ["user_roles", "DELETE", "outbox_user_roles"],
    ["role_grants", "INSERT", "outbox_role_grants"],
    ["role_grants", "DELETE", "outbox_role_grants"],
    ["user_roles", "INSERT", "signal_role_holders"],
    ["user_roles", "DELETE", "signal_role_holders"],
    ["role_grants", "INSERT", "signal_grants"],
    ["role_grants", "DELETE", "signal_grants"],
    ["session", "DELETE", "signal_ended_sessions"],
  ] as const) {
    yield* sql.unsafe(`
      CREATE TRIGGER ${table}_${op.toLowerCase()}_${fn} AFTER ${op} ON "${table}"
      REFERENCING ${op === "INSERT" ? "NEW" : "OLD"} TABLE AS changed
      FOR EACH STATEMENT EXECUTE FUNCTION ${fn}()
    `)
  }

  // --- Sign-in for standalone apps -------------------------------------------------------

  // Only hashes are stored. Codes are used once, within a minute.
  yield* sql`
    CREATE TABLE oauth_codes (
      code_hash text PRIMARY KEY,
      app_id text NOT NULL,
      session_id text NOT NULL REFERENCES session (id) ON DELETE CASCADE,
      redirect_uri text NOT NULL,
      expires_at timestamptz NOT NULL
    )
  `
  // Signing out of Core (or the session expiring) deletes the session, and with it these.
  yield* sql`
    CREATE TABLE oauth_refresh_tokens (
      token_hash text PRIMARY KEY,
      app_id text NOT NULL,
      session_id text NOT NULL REFERENCES session (id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz NOT NULL DEFAULT now()
    )
  `
  yield* sql`CREATE INDEX oauth_refresh_tokens_session_idx ON oauth_refresh_tokens (session_id)`
})
