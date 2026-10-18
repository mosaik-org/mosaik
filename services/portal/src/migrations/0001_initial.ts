import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/**
 * The Portal service's schema.
 *
 * - Installations: the apps the Portal installed, by URL (remote) or image (containers it
 *   runs), with their settings and the registries images are pulled from. Their identities
 *   live in Core; ids here are not foreign keys.
 * - What makes hundreds of apps manageable: each user's pinned apps and how they use apps,
 *   and the categories owners and admins chose. User ids are not foreign keys either (users
 *   live in Core): rows are removed when a user is deleted (platform event) or an app is
 *   uninstalled.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // --- Installations -------------------------------------------------------------------

  yield* sql`
    CREATE TABLE installations (
      app_id text PRIMARY KEY,
      source text NOT NULL CHECK (source IN ('remote', 'image')),
      -- Remote apps: where they are hosted.
      url text,
      -- Image apps: what runs, and what a rollback goes back to.
      image text,
      digest text,
      previous_image text,
      previous_digest text,
      database_mode text NOT NULL DEFAULT 'none' CHECK (database_mode IN ('none', 'platform', 'app')),
      -- Image apps' key, encrypted: their containers get it at every start.
      key_secret text,
      -- While a container is being started, or why it could not be.
      deployment text CHECK (deployment IN ('deploying', 'failed')),
      deployment_message text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  yield* sql`
    CREATE TABLE install_config (
      app_id text NOT NULL REFERENCES installations (app_id) ON DELETE CASCADE,
      name text NOT NULL,
      value text NOT NULL,
      secret boolean NOT NULL,
      PRIMARY KEY (app_id, name)
    )
  `
  yield* sql`
    CREATE TABLE registries (
      server text PRIMARY KEY,
      username text NOT NULL,
      password text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `

  // --- Workspace: pins, usage, categories ----------------------------------------------

  yield* sql`
    CREATE TABLE user_preferences (
      user_id text PRIMARY KEY,
      pinned_apps jsonb NOT NULL DEFAULT '[]',
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  yield* sql`
    CREATE TABLE app_usage (
      user_id text NOT NULL,
      app_id text NOT NULL,
      opens integer NOT NULL DEFAULT 1,
      first_opened_at timestamptz NOT NULL DEFAULT now(),
      last_opened_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, app_id)
    )
  `
  yield* sql`CREATE INDEX app_usage_app_idx ON app_usage (app_id, last_opened_at)`
  yield* sql`
    CREATE TABLE app_categories (
      app_id text PRIMARY KEY,
      category text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
})
