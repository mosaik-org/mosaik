import { Schema } from "effect"

/** Normalized Jira data, independent of Jira Cloud vs Data Center response shapes. Isomorphic. */

export const StatusCategory = Schema.Literals(["todo", "in-progress", "done"])
export type StatusCategory = typeof StatusCategory.Type

export class JiraProject extends Schema.Class<JiraProject>("@mosaik/connectors/JiraProject")({
  key: Schema.String,
  name: Schema.String,
}) {}

export class JiraIssue extends Schema.Class<JiraIssue>("@mosaik/connectors/JiraIssue")({
  key: Schema.String,
  summary: Schema.String,
  status: Schema.String,
  statusCategory: StatusCategory,
  type: Schema.String,
  priority: Schema.NullOr(Schema.String),
  assignee: Schema.NullOr(Schema.String),
  project: JiraProject,
  created: Schema.DateTimeUtc,
  updated: Schema.DateTimeUtc,
  /** Link to the issue in Jira. */
  url: Schema.String,
}) {}

export class JiraIssuePage extends Schema.Class<JiraIssuePage>("@mosaik/connectors/JiraIssuePage")({
  issues: Schema.Array(JiraIssue),
  /** Total matches; Jira Cloud's search no longer reports it. */
  total: Schema.NullOr(Schema.Int),
  /** Pass to the next search to continue; `null` on the last page. */
  nextCursor: Schema.NullOr(Schema.String),
}) {}
