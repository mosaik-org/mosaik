import { Effect } from "effect"
import { SqlClient } from "effect/sql"

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // People are kept after they leave: what they said still needs a name.
  yield* sql`
    CREATE TABLE people (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL,
      image text,
      is_agent boolean NOT NULL DEFAULT false,
      left_at timestamptz
    )
  `
  yield* sql`CREATE INDEX people_agents_idx ON people (name) WHERE is_agent AND left_at IS NULL`

  yield* sql`
    CREATE TABLE queues (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name text NOT NULL UNIQUE,
      description text NOT NULL DEFAULT ''
    )
  `

  yield* sql`
    CREATE TABLE deadline_rules (
      priority text PRIMARY KEY,
      respond_minutes integer NOT NULL CHECK (respond_minutes > 0),
      resolve_minutes integer NOT NULL CHECK (resolve_minutes > 0)
    )
  `
  yield* sql`
    INSERT INTO deadline_rules (priority, respond_minutes, resolve_minutes) VALUES
      ('urgent', 30, 240),
      ('high', 120, 480),
      ('normal', 480, 2880),
      ('low', 1440, 7200)
  `

  yield* sql`
    CREATE TABLE saved_replies (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title text NOT NULL,
      body text NOT NULL
    )
  `

  yield* sql`
    CREATE TABLE requests (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title text NOT NULL,
      body text NOT NULL,
      queue_id integer NOT NULL REFERENCES queues (id),
      priority text NOT NULL,
      status text NOT NULL,
      requester_id text NOT NULL REFERENCES people (id),
      assignee_id text REFERENCES people (id),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      respond_by timestamptz NOT NULL,
      resolve_by timestamptz NOT NULL,
      first_replied_at timestamptz,
      solved_at timestamptz,
      paused_at timestamptz,
      paused_seconds integer NOT NULL DEFAULT 0,
      last_activity_at timestamptz NOT NULL,
      last_activity_by text,
      -- What lists sort by: the deadline that counts now, none while the clock stands still.
      next_due_at timestamptz,
      -- The deadline people were last told was missed, so they are told once per deadline.
      overdue_notified_for timestamptz
    )
  `
  yield* sql`CREATE INDEX requests_next_due_idx ON requests (next_due_at) WHERE next_due_at IS NOT NULL`
  yield* sql`CREATE INDEX requests_assignee_idx ON requests (assignee_id, status)`
  yield* sql`CREATE INDEX requests_requester_idx ON requests (requester_id, last_activity_at DESC)`
  yield* sql`CREATE INDEX requests_queue_idx ON requests (queue_id, status)`

  yield* sql`
    CREATE TABLE activity (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      request_id integer NOT NULL REFERENCES requests (id) ON DELETE CASCADE,
      kind text NOT NULL,
      author_id text REFERENCES people (id),
      body text,
      field text,
      from_value text,
      to_value text,
      created_at timestamptz NOT NULL
    )
  `
  yield* sql`CREATE INDEX activity_request_idx ON activity (request_id, id)`

  yield* sql`
    CREATE TABLE request_reads (
      request_id integer NOT NULL REFERENCES requests (id) ON DELETE CASCADE,
      person_id text NOT NULL,
      read_at timestamptz NOT NULL,
      PRIMARY KEY (request_id, person_id)
    )
  `
})
