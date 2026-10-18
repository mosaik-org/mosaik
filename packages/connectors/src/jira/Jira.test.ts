import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Redacted } from "effect"
import { HttpClient, type HttpClientRequest, HttpClientResponse } from "effect/http"
import * as Auth from "../Auth"
import * as Connector from "../Connector"
import { makeFixtures, makeLive } from "./Jira"

type Handler = (request: HttpClientRequest.HttpClientRequest, url: URL) => Response

/** An HttpClient that answers from `handler` and records what was requested. */
const fakeHttp = (handler: Handler) => {
  const requests: Array<{ url: URL; headers: Record<string, string> }> = []
  const layer = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      requests.push({ url, headers: request.headers })
      return Effect.succeed(HttpClientResponse.fromWeb(request, handler(request, url)))
    }),
  )
  return { layer, requests }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

const rawIssue = (key: string, category = "indeterminate") => ({
  key,
  fields: {
    summary: `Summary of ${key}`,
    status: { name: "In Progress", statusCategory: { key: category } },
    issuetype: { name: "Bug" },
    priority: { name: "High" },
    assignee: { displayName: "Ada Lovelace" },
    project: { key: "OPS", name: "Operations" },
    created: "2026-10-01T08:00:00.000+0200",
    updated: "2026-10-02T09:30:00.000+0000",
  },
})

const connector = (options: Partial<Connector.ConnectorOptions> = {}) =>
  Connector.make({
    name: "Jira",
    baseUrl: new URL("https://jira.example.com"),
    auth: Auth.bearer(Redacted.make("secret-token")),
    retries: 0,
    ...options,
  })

describe("Jira (Data Center)", () => {
  it.effect("searches with offset pagination, auth and normalized issues", () => {
    const http = fakeHttp(() =>
      json({ startAt: 0, maxResults: 2, total: 3, issues: [rawIssue("OPS-1"), rawIssue("OPS-2", "done")] }),
    )
    return Effect.gen(function* () {
      const jira = makeLive(yield* connector(), "datacenter")
      const page = yield* jira.search({ jql: "project = OPS", maxResults: 2 })

      expect(page.total).toBe(3)
      expect(page.nextCursor).toBe("2")
      expect(page.issues.map((issue) => [issue.key, issue.statusCategory])).toEqual([
        ["OPS-1", "in-progress"],
        ["OPS-2", "done"],
      ])
      const [first] = page.issues
      expect(first?.url).toBe("https://jira.example.com/browse/OPS-1")
      expect(first?.created.epochMilliseconds).toBe(Date.parse("2026-10-01T06:00:00.000Z"))

      const [request] = http.requests
      expect(request?.url.pathname).toBe("/rest/api/2/search")
      expect(request?.url.searchParams.get("jql")).toBe("project = OPS")
      expect(request?.headers.authorization).toBe("Bearer secret-token")
    }).pipe(Effect.provide(http.layer))
  })
})

describe("Jira (Cloud)", () => {
  it.effect("uses the token-paginated search endpoint", () => {
    const http = fakeHttp(() => json({ issues: [rawIssue("WEB-7")], nextPageToken: "abc" }))
    return Effect.gen(function* () {
      const jira = makeLive(
        yield* connector({ auth: Auth.basic("me@example.com", Redacted.make("api-token")) }),
        "cloud",
      )
      const page = yield* jira.search({ jql: "project = WEB", cursor: "previous" })

      expect(page.total).toBeNull()
      expect(page.nextCursor).toBe("abc")
      const [request] = http.requests
      expect(request?.url.pathname).toBe("/rest/api/3/search/jql")
      expect(request?.url.searchParams.get("nextPageToken")).toBe("previous")
      expect(request?.headers.authorization).toBe(`Basic ${btoa("me@example.com:api-token")}`)
    }).pipe(Effect.provide(http.layer))
  })
})

describe("Connector", () => {
  it.effect("maps HTTP failures to typed connector errors", () => {
    const http = fakeHttp(() => json({ message: "nope" }, 401))
    return Effect.gen(function* () {
      const jira = makeLive(yield* connector(), "datacenter")
      const error = yield* Effect.flip(jira.search({ jql: "x" }))
      expect(error._tag).toBe("ConnectorError")
      expect(error.reason).toBe("Unauthorized")
      expect(error.status).toBe(401)
    }).pipe(Effect.provide(http.layer))
  })

  // Real clock: the backoff between retries actually sleeps.
  it.live("retries transient failures", () => {
    let calls = 0
    const http = fakeHttp(() => (++calls < 3 ? json({}, 503) : json([{ key: "OPS", name: "Operations" }])))
    return Effect.gen(function* () {
      const jira = makeLive(yield* connector({ retries: 2 }), "datacenter")
      const projects = yield* jira.projects
      expect(projects.map((p) => p.key)).toEqual(["OPS"])
      expect(calls).toBe(3)
    }).pipe(Effect.provide(http.layer))
  })

  it.effect("rejects responses that do not match the schema", () => {
    const http = fakeHttp(() => json({ unexpected: true }))
    return Effect.gen(function* () {
      const jira = makeLive(yield* connector(), "datacenter")
      const error = yield* Effect.flip(jira.search({ jql: "x" }))
      expect(error.reason).toBe("InvalidResponse")
    }).pipe(Effect.provide(http.layer))
  })

  it.effect("caches lookups and reports when the data was fetched", () => {
    let calls = 0
    const http = fakeHttp(() => {
      calls++
      return json([{ key: "OPS", name: "Operations" }])
    })
    return Effect.gen(function* () {
      const client = yield* connector()
      const projects = yield* client.cached((_: "all") => makeLive(client, "datacenter").projects, { ttl: "1 minute" })
      const first = yield* projects("all")
      const second = yield* projects("all")
      expect(calls).toBe(1)
      expect(second.asOf).toEqual(first.asOf)
      expect(first.source).toBe("Jira")
    }).pipe(Effect.provide(http.layer))
  })
})

describe("Jira fixtures", () => {
  it.effect("filter by project, open status and text", () =>
    Effect.gen(function* () {
      const jira = makeFixtures()
      const page = yield* jira.search({ jql: 'project = OPS AND statusCategory != Done AND text ~ "deploy"' })
      expect(page.issues.length).toBeGreaterThan(0)
      for (const issue of page.issues) {
        expect(issue.project.key).toBe("OPS")
        expect(issue.statusCategory).not.toBe("done")
        expect(issue.summary.toLowerCase()).toContain("deploy")
      }
    }),
  )
})
