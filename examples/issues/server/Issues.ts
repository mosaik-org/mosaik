import type { Fresh } from "@mosaik/sdk"
import { Connector, type ConnectorError } from "@mosaik/sdk/connectors"
import { Jira } from "@mosaik/sdk/connectors/jira"
import { Context, Effect, Layer } from "effect"
import { IssueList, type IssuesSearch, type JiraProject, type StatusCategory } from "../api"

/** Issues loaded per query; enough for a team-level overview. */
const LIMIT = 200

const CATEGORY_NAMES: Record<StatusCategory, string> = { todo: "To Do", "in-progress": "In Progress", done: "Done" }

/** `text ~` does not match issue keys, so key-shaped searches look the issue up directly. */
const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/i

const quote = (value: string) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`

/** Builds JQL from validated filters (values are quoted, so they cannot change the query). */
export const toJql = (search: IssuesSearch): string => {
  const text = search.q?.trim() ?? ""
  const key = ISSUE_KEY.test(text) ? text.toUpperCase() : undefined
  return [
    search.project === undefined ? undefined : `project = ${quote(search.project)}`,
    search.category !== undefined
      ? `statusCategory = ${quote(CATEGORY_NAMES[search.category])}`
      : // A specific issue is shown whatever its status; otherwise default to open issues.
        key === undefined
        ? "statusCategory != Done"
        : undefined,
    key !== undefined ? `key = ${quote(key)}` : text !== "" ? `text ~ ${quote(text)}` : undefined,
  ]
    .filter((clause) => clause !== undefined)
    .join(" AND ")
    .concat(" ORDER BY updated DESC")
}

/** Jira reads for the app, cached for a couple of minutes to spare Jira. */
export class Issues extends Context.Service<
  Issues,
  {
    list(search: IssuesSearch): Effect.Effect<Fresh<IssueList>, ConnectorError>
    readonly projects: Effect.Effect<Fresh<ReadonlyArray<JiraProject>>, ConnectorError>
  }
>()("@mosaik/issues/Issues") {
  static readonly layer = Layer.effect(
    Issues,
    Effect.gen(function* () {
      const jira = yield* Jira

      const load = Effect.fn("Issues.load")(function* (jql: string) {
        const loaded = []
        let cursor: string | undefined
        do {
          const page = yield* jira.search({ jql, maxResults: 100, cursor })
          loaded.push(...page.issues)
          cursor = page.nextCursor ?? undefined
        } while (cursor !== undefined && loaded.length < LIMIT)
        return new IssueList({
          issues: loaded.slice(0, LIMIT),
          truncated: cursor !== undefined || loaded.length > LIMIT,
        })
      })

      const list = yield* Connector.cache(load, { ttl: "2 minutes", source: jira.source })
      const projects = yield* Connector.cache((_: "all") => jira.projects, { ttl: "1 hour", source: jira.source })

      return Issues.of({
        list: (search) => list(toJql(search)),
        projects: projects("all"),
      })
    }),
  ).pipe(Layer.provide(Jira.layer))
}
