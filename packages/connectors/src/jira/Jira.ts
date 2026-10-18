import { Config, Context, DateTime, Effect, Layer, Option, Schema } from "effect"
import type { HttpClient } from "effect/http"
import * as Auth from "../Auth"
import * as Connector from "../Connector"
import { ConnectorError } from "../ConnectorError"
import { JiraIssue, JiraIssuePage, JiraProject, type StatusCategory } from "./model"
import { CloudProjectPage, CloudSearch, DataCenterSearch, ISSUE_FIELDS, RawIssue, RawProject } from "./raw"

export interface JiraSearch {
  /** JQL, e.g. `project = OPS AND statusCategory != Done ORDER BY updated DESC`. */
  readonly jql: string
  /** Defaults to 50 (Jira caps it, usually at 100). */
  readonly maxResults?: number
  /** `nextCursor` of the previous page. */
  readonly cursor?: string | undefined
}

export interface JiraService {
  /** Base URL of the Jira site (for links). */
  readonly siteUrl: string
  /** Label for freshness indicators, e.g. "Jira" or "Jira (sample data)". */
  readonly source: string
  search(options: JiraSearch): Effect.Effect<JiraIssuePage, ConnectorError>
  issue(key: string): Effect.Effect<JiraIssue, ConnectorError>
  readonly projects: Effect.Effect<ReadonlyArray<JiraProject>, ConnectorError>
  readonly health: Effect.Effect<Connector.ConnectorHealth>
}

/**
 * Jira Cloud and Jira Data Center / Server.
 *
 * Configuration:
 * - `JIRA_URL`, e.g. `https://jira.example.com` or `https://acme.atlassian.net`
 * - Data Center: `JIRA_TOKEN` (personal access token)
 * - Cloud: `JIRA_EMAIL` + `JIRA_API_TOKEN`
 * - `JIRA_FLAVOR` = `cloud` | `datacenter` (detected from the URL when unset)
 *
 * Without `JIRA_URL` outside production, or with `CONNECTORS_MODE=fixtures`, built-in
 * sample data is used so apps work locally without credentials.
 */
export class Jira extends Context.Service<Jira, JiraService>()("@mosaik/connectors/Jira") {
  static readonly layer: Layer.Layer<Jira, Config.ConfigError, HttpClient.HttpClient> = Layer.unwrap(
    Effect.gen(function* () {
      const mode = yield* Config.String("CONNECTORS_MODE").pipe(Config.withDefault("auto"))
      const env = yield* Config.String("NODE_ENV").pipe(Config.withDefault("development"))
      const url = yield* Config.option(Config.URL("JIRA_URL"))
      if (mode === "fixtures" || (Option.isNone(url) && env !== "production")) {
        yield* Effect.logWarning("Jira is not configured: using sample data (set JIRA_URL to connect)")
        return Jira.layerFixtures
      }
      return Jira.layerLive
    }),
  )

  static readonly layerLive: Layer.Layer<Jira, Config.ConfigError, HttpClient.HttpClient> = Layer.effect(
    Jira,
    Effect.gen(function* () {
      const baseUrl = yield* Config.URL("JIRA_URL")
      // Empty (e.g. unset in docker compose) means: detect from the URL.
      const configured = yield* Config.String("JIRA_FLAVOR").pipe(Config.withDefault(""))
      const flavor =
        configured === "cloud" || configured === "datacenter"
          ? configured
          : baseUrl.hostname.endsWith(".atlassian.net")
            ? "cloud"
            : "datacenter"
      const auth =
        flavor === "cloud"
          ? Auth.basic(yield* Config.String("JIRA_EMAIL"), yield* Config.Redacted("JIRA_API_TOKEN"))
          : Auth.bearer(yield* Config.Redacted("JIRA_TOKEN"))
      const connector = yield* Connector.make({
        name: "Jira",
        baseUrl,
        auth,
        rateLimit: { limit: 10, window: "1 second" },
      })
      return makeLive(connector, flavor)
    }),
  )

  static readonly layerFixtures: Layer.Layer<Jira> = Layer.sync(Jira, () => makeFixtures())
}

const CATEGORIES: Record<string, StatusCategory> = { new: "todo", indeterminate: "in-progress", done: "done" }

/** Jira timestamps look like `2024-05-01T10:11:12.000+0200`; normalize the offset to `+02:00`. */
const parseDate = (value: string) =>
  Option.match(DateTime.make(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")), {
    onNone: () =>
      Effect.fail(
        new ConnectorError({ connector: "Jira", reason: "InvalidResponse", message: `Invalid date: ${value}` }),
      ),
    onSome: (date) => Effect.succeed(DateTime.toUtc(date)),
  })

export const toIssue = (siteUrl: string) =>
  Effect.fnUntraced(function* (raw: RawIssue) {
    const { fields } = raw
    return new JiraIssue({
      key: raw.key,
      summary: fields.summary,
      status: fields.status.name,
      statusCategory: CATEGORIES[fields.status.statusCategory.key] ?? "todo",
      type: fields.issuetype.name,
      priority: fields.priority?.name ?? null,
      assignee: fields.assignee?.displayName ?? null,
      project: new JiraProject(fields.project),
      created: yield* parseDate(fields.created),
      updated: yield* parseDate(fields.updated),
      url: new URL(`/browse/${raw.key}`, siteUrl).toString(),
    })
  })

export const makeLive = (connector: Connector.Connector, flavor: "cloud" | "datacenter"): JiraService => {
  const api = flavor === "cloud" ? "/rest/api/3" : "/rest/api/2"
  const siteUrl = connector.baseUrl.toString()
  const issue = toIssue(siteUrl)
  const fields = ISSUE_FIELDS.join(",")

  const search = Effect.fn("Jira.search")(function* (options: JiraSearch) {
    const maxResults = options.maxResults ?? 50
    if (flavor === "cloud") {
      const page = yield* connector.get(`${api}/search/jql`, CloudSearch, {
        query: { jql: options.jql, maxResults, fields, nextPageToken: options.cursor },
      })
      return new JiraIssuePage({
        issues: yield* Effect.forEach(page.issues, issue),
        total: null,
        nextCursor: page.nextPageToken ?? null,
      })
    }
    const startAt = Number(options.cursor ?? 0)
    const page = yield* connector.get(`${api}/search`, DataCenterSearch, {
      query: { jql: options.jql, maxResults, startAt, fields },
    })
    const next = page.startAt + page.issues.length
    return new JiraIssuePage({
      issues: yield* Effect.forEach(page.issues, issue),
      total: page.total,
      nextCursor: next < page.total && page.issues.length > 0 ? String(next) : null,
    })
  })

  return {
    siteUrl,
    source: "Jira",
    search,
    issue: Effect.fn("Jira.issue")(function* (key: string) {
      const raw = yield* connector.get(`${api}/issue/${encodeURIComponent(key)}`, RawIssue, { query: { fields } })
      return yield* issue(raw)
    }),
    projects:
      flavor === "cloud"
        ? connector
            .get(`${api}/project/search`, CloudProjectPage, { query: { maxResults: 100 } })
            .pipe(Effect.map((page) => page.values.map((p) => new JiraProject(p))))
        : connector
            .get(`${api}/project`, Schema.Array(RawProject))
            .pipe(Effect.map((projects) => projects.map((p) => new JiraProject(p)))),
    health: connector.health(`${api}/myself`),
  }
}

/** Deterministic sample data for local development and tests. */
export const makeFixtures = (): JiraService => {
  const { issues, projects } = fixtureData()
  const siteUrl = "https://jira.example.com/"

  const matches = (jql: string) => {
    const project = /project\s*=\s*"?([A-Z]+)"?/i.exec(jql)?.[1]?.toUpperCase()
    const open = /statusCategory\s*!=\s*"?done"?/i.test(jql)
    const category = /statusCategory\s*=\s*"([^"]+)"/i.exec(jql)?.[1]?.toLowerCase()
    const text = /text\s*~\s*"([^"]*)"/i.exec(jql)?.[1]?.toLowerCase()
    const key = /\bkey\s*=\s*"([^"]+)"/i.exec(jql)?.[1]?.toUpperCase()
    const categories: Record<string, StatusCategory> = { "to do": "todo", "in progress": "in-progress", done: "done" }
    return (issue: JiraIssue) =>
      (project === undefined || issue.project.key === project) &&
      (!open || issue.statusCategory !== "done") &&
      (category === undefined || issue.statusCategory === categories[category]) &&
      (key === undefined || issue.key === key) &&
      (text === undefined || `${issue.key} ${issue.summary}`.toLowerCase().includes(text))
  }

  return {
    siteUrl,
    source: "Jira (sample data)",
    search: (options) =>
      Effect.sync(() => {
        const found = issues.filter(matches(options.jql))
        const start = Number(options.cursor ?? 0)
        const end = start + (options.maxResults ?? 50)
        return new JiraIssuePage({
          issues: found.slice(start, end),
          total: found.length,
          nextCursor: end < found.length ? String(end) : null,
        })
      }).pipe(Effect.withSpan("Jira.search (fixtures)")),
    issue: (key) =>
      Effect.fromNullishOr(issues.find((issue) => issue.key === key)).pipe(
        Effect.mapError(
          () => new ConnectorError({ connector: "Jira", reason: "NotFound", message: `Issue ${key} not found` }),
        ),
      ),
    projects: Effect.succeed(projects),
    health: Effect.succeed({ connector: "Jira (sample data)", ok: true, latencyMs: 0 }),
  }
}

const fixtureData = () => {
  const projects = [
    new JiraProject({ key: "OPS", name: "Operations" }),
    new JiraProject({ key: "WEB", name: "Web Platform" }),
    new JiraProject({ key: "DATA", name: "Data Engineering" }),
  ]
  const people = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Margaret Hamilton", "Linus Torvalds", null]
  const statuses: ReadonlyArray<[string, StatusCategory]> = [
    ["To Do", "todo"],
    ["In Progress", "in-progress"],
    ["In Review", "in-progress"],
    ["Done", "done"],
  ]
  const subjects = [
    "Login fails on Safari",
    "Upgrade Postgres",
    "Flaky deploy pipeline",
    "Add CSV export",
    "Slow app query",
    "Rotate API keys",
    "Improve alerting",
    "Fix timezone bug",
  ]
  const now = Date.UTC(2026, 9, 15, 12)
  const issues = Array.from({ length: 72 }, (_, i) => {
    const project = projects[i % projects.length] as JiraProject
    const [status, statusCategory] = statuses[(i * 7) % statuses.length] as [string, StatusCategory]
    const created = DateTime.makeUnsafe(now - (i * 37 + 5) * 3_600_000)
    return new JiraIssue({
      key: `${project.key}-${100 + i}`,
      summary: `${subjects[i % subjects.length]} (${i + 1})`,
      status,
      statusCategory,
      type: i % 5 === 0 ? "Bug" : i % 3 === 0 ? "Story" : "Task",
      priority: ["Highest", "High", "Medium", "Low"][i % 4] ?? null,
      assignee: people[(i * 5 + Math.floor(i / 3)) % people.length] ?? null,
      project,
      created,
      updated: DateTime.makeUnsafe(DateTime.toEpochMillis(created) + (i % 9) * 3_600_000),
      url: `https://jira.example.com/browse/${project.key}-${100 + i}`,
    })
  })
  return { issues, projects }
}
