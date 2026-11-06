import { Effect } from "effect"
import { SqlClient } from "effect/sql"

/**
 * Demo data so the example has something to show: three queues, a team, and requests in every state,
 * with deadlines around now. Delete this and `server/demo.ts` for a real app.
 *
 * `demo-you` stands for whoever opens the desk first with the right to work on requests: a trigger
 * hands them what is theirs, so the inbox opens with work rather than empty.
 */

interface Seed {
  readonly title: string
  readonly body: string
  readonly queue: string
  readonly priority: "urgent" | "high" | "normal" | "low"
  readonly status: "new" | "open" | "waiting" | "solved" | "closed"
  readonly requester: string
  readonly assignee?: string
  /** How long ago it came, in minutes. */
  readonly age: number
  /** Answered this long after it came, in minutes. */
  readonly answeredAfter?: number
  readonly replies?: ReadonlyArray<readonly [author: string, kind: "reply" | "note", body: string]>
}

const PEOPLE: ReadonlyArray<readonly [id: string, name: string, email: string, agent: boolean]> = [
  ["demo-you", "You", "you@example.com", true],
  ["demo-priya", "Priya Nair", "priya.nair@example.com", true],
  ["demo-tomas", "Tomás Herrera", "tomas.herrera@example.com", true],
  ["demo-sofia", "Sofia Lindqvist", "sofia.lindqvist@example.com", true],
  ["demo-kwame", "Kwame Mensah", "kwame.mensah@example.com", false],
  ["demo-hannah", "Hannah Weiss", "hannah.weiss@example.com", false],
  ["demo-jun", "Jun Tanaka", "jun.tanaka@example.com", false],
  ["demo-amara", "Amara Obi", "amara.obi@example.com", false],
  ["demo-lucas", "Lucas Moreau", "lucas.moreau@example.com", false],
  ["demo-elena", "Elena Rossi", "elena.rossi@example.com", false],
]

const QUEUES: ReadonlyArray<readonly [name: string, description: string]> = [
  ["IT", "Laptops, accounts, access and software"],
  ["HR", "Leave, contracts, payroll questions and onboarding"],
  ["Finance", "Expenses, invoices and purchases"],
]

const SAVED_REPLIES: ReadonlyArray<readonly [title: string, body: string]> = [
  [
    "Need more details",
    "Thanks for reaching out. Could you tell me what you were doing when this happened, and send a screenshot if you have one?",
  ],
  [
    "Restart first",
    "Could you restart it and try again? If it still happens after that, let me know and I'll take a closer look.",
  ],
  [
    "Sent to a colleague",
    "I've passed this to a colleague who knows this area best. They'll pick it up from here, so there's nothing you need to do.",
  ],
  [
    "All done",
    "This should be sorted now. If anything still looks wrong, just reply here and the request will reopen.",
  ],
]

const REQUESTS: ReadonlyArray<Seed> = [
  {
    title: "VPN drops every few minutes since this morning",
    body: "I'm on a client call at 14:00 and can't stay connected. It reconnects by itself, then drops again after two or three minutes. I've tried the office and home networks.",
    queue: "IT",
    priority: "urgent",
    status: "new",
    requester: "demo-kwame",
    age: 45,
  },
  {
    title: "Can't sign in to payroll after password reset",
    body: "I reset my password yesterday and now payroll says my account is locked. Salary slips are due for my mortgage application today.",
    queue: "HR",
    priority: "high",
    status: "open",
    requester: "demo-hannah",
    assignee: "demo-you",
    age: 150,
    replies: [
      [
        "demo-you",
        "note",
        "Locked after three failed attempts. Asked the payroll vendor to unlock it, waiting on them.",
      ],
    ],
  },
  {
    title: "Laptop fan runs at full speed and the screen flickers",
    body: "It started after the update on Monday. It gets very hot within ten minutes of opening anything. Battery lasts about an hour.",
    queue: "IT",
    priority: "high",
    status: "open",
    requester: "demo-jun",
    assignee: "demo-you",
    age: 100,
    answeredAfter: 20,
    replies: [
      [
        "demo-you",
        "reply",
        "Could you send me the model and whether it is still under warranty? Sticker on the bottom.",
      ],
      ["demo-jun", "reply", "It's a 14-inch from March last year. Sticker says WX-2231."],
    ],
  },
  {
    title: "Expense report rejected without a reason",
    body: "My expenses for the Lisbon trip came back rejected and there's no comment. Flights and hotel were approved beforehand.",
    queue: "Finance",
    priority: "normal",
    status: "open",
    requester: "demo-amara",
    assignee: "demo-you",
    age: 300,
    answeredAfter: 60,
    replies: [
      ["demo-you", "reply", "Looking into it now. The approver is away, so I'm checking who stood in for them."],
    ],
  },
  {
    title: "New starter on Monday needs a laptop and accounts",
    body: "Maya Patel joins the design team on Monday. She needs a laptop, an email address, and access to the design tools.",
    queue: "IT",
    priority: "normal",
    status: "new",
    requester: "demo-lucas",
    age: 40,
  },
  {
    title: "How many days of leave carry over to next year?",
    body: "I have nine days left and won't manage to take them all. Do they carry over, and is there a deadline for using them?",
    queue: "HR",
    priority: "low",
    status: "new",
    requester: "demo-elena",
    age: 200,
  },
  {
    title: "Invoice from Northwind paid twice",
    body: "Northwind's invoice 8841 shows two payments in October. They've already emailed asking how to return the second one.",
    queue: "Finance",
    priority: "urgent",
    status: "open",
    requester: "demo-amara",
    assignee: "demo-priya",
    age: 200,
    answeredAfter: 15,
    replies: [["demo-priya", "reply", "Confirmed the duplicate. I've asked the bank to recall it."]],
  },
  {
    title: "Access to the customer analytics dashboard",
    body: "I've moved to the insights team and need read access to the analytics dashboard. My manager has approved it.",
    queue: "IT",
    priority: "normal",
    status: "open",
    requester: "demo-kwame",
    assignee: "demo-tomas",
    age: 500,
    answeredAfter: 90,
    replies: [["demo-tomas", "reply", "Requested from the dashboard's owner. Usually takes a day."]],
  },
  {
    title: "Parental leave: what do I need to send and by when?",
    body: "We're expecting in April. Who do I tell first, what forms are there, and how far ahead do they need them?",
    queue: "HR",
    priority: "normal",
    status: "new",
    requester: "demo-jun",
    age: 420,
  },
  {
    title: "Meeting room display stuck on the login screen",
    body: "The display in Aurora won't get past the login screen. Three meetings today had to move.",
    queue: "IT",
    priority: "high",
    status: "new",
    requester: "demo-hannah",
    assignee: "demo-sofia",
    age: 90,
  },
  {
    title: "Corporate card declined abroad",
    body: "My card was declined in Berlin twice this morning, though the limit is fine. I have a client dinner tonight.",
    queue: "Finance",
    priority: "high",
    status: "waiting",
    requester: "demo-lucas",
    assignee: "demo-you",
    age: 180,
    answeredAfter: 25,
    replies: [
      [
        "demo-you",
        "reply",
        "The bank flagged it as unusual. Can you confirm the last two transactions so I can get it unblocked?",
      ],
    ],
  },
  {
    title: "Monitor for working from home",
    body: "Am I allowed a second monitor at home? My team lead said to ask here.",
    queue: "IT",
    priority: "low",
    status: "waiting",
    requester: "demo-elena",
    assignee: "demo-tomas",
    age: 2000,
    answeredAfter: 300,
    replies: [["demo-tomas", "reply", "Yes. Which size do you need, and where should we send it?"]],
  },
  {
    title: "Contract says part time, I moved to full time in June",
    body: "My contract letter still says 60%. Payroll is right, but I need a corrected letter for my landlord.",
    queue: "HR",
    priority: "normal",
    status: "open",
    requester: "demo-kwame",
    assignee: "demo-sofia",
    age: 1500,
    answeredAfter: 200,
    replies: [["demo-sofia", "reply", "I'll have a corrected letter drafted by the end of the week."]],
  },
  {
    title: "Purchase approval for 12 design tool licences",
    body: "The design team is growing. We need twelve more licences at about €480 a year each, from next quarter.",
    queue: "Finance",
    priority: "low",
    status: "new",
    requester: "demo-lucas",
    age: 700,
  },
  {
    title: "Shared drive says I'm out of space",
    body: "I can't save anything to the team drive. It says the quota is used up.",
    queue: "IT",
    priority: "normal",
    status: "solved",
    requester: "demo-amara",
    assignee: "demo-you",
    age: 3000,
    answeredAfter: 40,
    replies: [
      ["demo-you", "reply", "Doubled the team's quota. Could you try again?"],
      ["demo-amara", "reply", "Works now, thank you!"],
    ],
  },
  {
    title: "Printer on the third floor jams every page",
    body: "Every page comes out crumpled. We've tried a new tray of paper.",
    queue: "IT",
    priority: "low",
    status: "solved",
    requester: "demo-hannah",
    assignee: "demo-tomas",
    age: 5000,
    answeredAfter: 400,
    replies: [["demo-tomas", "reply", "The roller was worn out. Replaced it this morning."]],
  },
  {
    title: "Reimbursement for a conference ticket",
    body: "Could you confirm the ticket for the design conference was paid? It hasn't shown up in my last two slips.",
    queue: "Finance",
    priority: "normal",
    status: "closed",
    requester: "demo-jun",
    assignee: "demo-priya",
    age: 20000,
    answeredAfter: 300,
    replies: [["demo-priya", "reply", "It went out with last month's run. You'll see it on your next slip."]],
  },
  // Sent by the person trying the demo, so My requests has something too.
  {
    title: "Software licence for the video editor",
    body: "I need the video editor for the onboarding videos. Is there a licence free, or do we buy one?",
    queue: "IT",
    priority: "normal",
    status: "waiting",
    requester: "demo-you",
    assignee: "demo-tomas",
    age: 600,
    answeredAfter: 120,
    replies: [["demo-tomas", "reply", "There's one free. Will you need it past this quarter?"]],
  },
  {
    title: "Update my home address for payslips",
    body: "I've moved. Where do I change my address so payslips go to the new one?",
    queue: "HR",
    priority: "low",
    status: "open",
    requester: "demo-you",
    assignee: "demo-sofia",
    age: 900,
    answeredAfter: 200,
    replies: [["demo-sofia", "reply", "I can change it for you. I just need the new address and the date you moved."]],
  },
]

const RULES = {
  urgent: [30, 240],
  high: [120, 480],
  normal: [480, 2880],
  low: [1440, 7200],
} as const

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  for (const [id, name, email, agent] of PEOPLE) {
    yield* sql`INSERT INTO people (id, name, email, is_agent) VALUES (${id}, ${name}, ${email}, ${agent})`
  }
  for (const [name, description] of QUEUES) {
    yield* sql`INSERT INTO queues (name, description) VALUES (${name}, ${description})`
  }
  for (const [title, body] of SAVED_REPLIES) {
    yield* sql`INSERT INTO saved_replies (title, body) VALUES (${title}, ${body})`
  }

  yield* sql`CREATE TABLE demo_requests (id integer PRIMARY KEY REFERENCES requests (id) ON DELETE CASCADE)`
  yield* sql`CREATE TABLE demo_state (refreshed_at timestamptz NOT NULL)`
  yield* sql`INSERT INTO demo_state (refreshed_at) VALUES (now())`

  for (const seed of REQUESTS) {
    const [respond, resolve] = RULES[seed.priority]
    const paused = seed.status === "waiting" || seed.status === "solved" || seed.status === "closed"
    const quiet = seed.replies?.at(-1)?.[0] ?? seed.requester
    const [created] = yield* sql<{ id: number }>`
      INSERT INTO requests (title, body, queue_id, priority, status, requester_id, assignee_id, created_at, updated_at,
        respond_by, resolve_by, first_replied_at, solved_at, paused_at, last_activity_at, last_activity_by, next_due_at)
      SELECT ${seed.title}, ${seed.body}, q.id, ${seed.priority}, ${seed.status}, ${seed.requester},
        ${seed.assignee ?? null}, t.at, t.at,
        t.at + make_interval(mins => ${respond}), t.at + make_interval(mins => ${resolve}),
        ${seed.answeredAfter === undefined ? sql`NULL::timestamptz` : sql`t.at + make_interval(mins => ${seed.answeredAfter})`},
        ${seed.status === "solved" || seed.status === "closed" ? sql`now() - interval '1 hour'` : sql`NULL::timestamptz`},
        ${paused ? sql`now() - interval '1 hour'` : sql`NULL::timestamptz`},
        now() - interval '1 hour', ${quiet},
        ${
          paused
            ? sql`NULL::timestamptz`
            : seed.answeredAfter === undefined
              ? sql`t.at + make_interval(mins => ${respond})`
              : sql`t.at + make_interval(mins => ${resolve})`
        }
      FROM queues q, (SELECT now() - make_interval(mins => ${seed.age}) AS at) t
      WHERE q.name = ${seed.queue}
      RETURNING id
    `
    if (created === undefined) continue
    yield* sql`INSERT INTO demo_requests (id) VALUES (${created.id})`
    yield* sql`
      INSERT INTO activity (request_id, kind, author_id, created_at)
      VALUES (${created.id}, 'created', ${seed.requester}, now() - make_interval(mins => ${seed.age}))
    `
    let order = seed.replies?.length ?? 0
    for (const [author, kind, body] of seed.replies ?? []) {
      yield* sql`
        INSERT INTO activity (request_id, kind, author_id, body, created_at)
        VALUES (${created.id}, ${kind}, ${author}, ${body}, now() - make_interval(mins => ${order * 7}))
      `
      order -= 1
    }
  }

  // The first real agent takes over `demo-you`, so what the demo set aside for them is theirs.
  yield* sql`
    CREATE FUNCTION adopt_demo() RETURNS trigger AS $$
    BEGIN
      IF NEW.is_agent AND NEW.id NOT LIKE 'demo-%' AND EXISTS (SELECT 1 FROM people WHERE id = 'demo-you') THEN
        UPDATE requests SET assignee_id = NEW.id WHERE assignee_id = 'demo-you';
        UPDATE requests SET requester_id = NEW.id WHERE requester_id = 'demo-you';
        UPDATE requests SET last_activity_by = NEW.id WHERE last_activity_by = 'demo-you';
        UPDATE activity SET author_id = NEW.id WHERE author_id = 'demo-you';
        DELETE FROM people WHERE id = 'demo-you';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `
  yield* sql`CREATE TRIGGER people_adopt_demo AFTER INSERT OR UPDATE OF is_agent ON people FOR EACH ROW EXECUTE FUNCTION adopt_demo()`

  // Keeps the demo's open requests where they were against the clock, however long ago it was set up.
  yield* sql`
    CREATE FUNCTION refresh_demo() RETURNS void AS $$
    DECLARE moved interval;
    BEGIN
      SELECT now() - refreshed_at INTO moved FROM demo_state;
      UPDATE requests SET
        created_at = created_at + moved,
        updated_at = updated_at + moved,
        respond_by = respond_by + moved,
        resolve_by = resolve_by + moved,
        first_replied_at = first_replied_at + moved,
        paused_at = paused_at + moved,
        last_activity_at = last_activity_at + moved,
        next_due_at = next_due_at + moved
      WHERE id IN (SELECT id FROM demo_requests) AND status IN ('new', 'open', 'waiting');
      UPDATE activity SET created_at = created_at + moved
      WHERE request_id IN (
        SELECT id FROM requests WHERE id IN (SELECT id FROM demo_requests) AND status IN ('new', 'open', 'waiting')
      );
      UPDATE demo_state SET refreshed_at = now();
    END;
    $$ LANGUAGE plpgsql
  `
})
