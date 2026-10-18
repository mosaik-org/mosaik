import { Schema } from "effect"

/** Raw Jira REST shapes (only the fields we request). Cloud (v3) and Data Center (v2) share them. */

const Named = Schema.Struct({ name: Schema.String })

export const RawIssue = Schema.Struct({
  key: Schema.String,
  fields: Schema.Struct({
    summary: Schema.String,
    status: Schema.Struct({ name: Schema.String, statusCategory: Schema.Struct({ key: Schema.String }) }),
    issuetype: Named,
    priority: Schema.optional(Schema.NullOr(Named)),
    assignee: Schema.optional(Schema.NullOr(Schema.Struct({ displayName: Schema.String }))),
    project: Schema.Struct({ key: Schema.String, name: Schema.String }),
    created: Schema.String,
    updated: Schema.String,
  }),
})
export type RawIssue = typeof RawIssue.Type

/** Data Center `GET /rest/api/2/search` (offset pagination). */
export const DataCenterSearch = Schema.Struct({
  startAt: Schema.Number,
  maxResults: Schema.Number,
  total: Schema.Number,
  issues: Schema.Array(RawIssue),
})

/** Cloud `GET /rest/api/3/search/jql` (token pagination, no total). */
export const CloudSearch = Schema.Struct({
  issues: Schema.Array(RawIssue),
  nextPageToken: Schema.optional(Schema.NullOr(Schema.String)),
})

export const RawProject = Schema.Struct({ key: Schema.String, name: Schema.String })

export const CloudProjectPage = Schema.Struct({ values: Schema.Array(RawProject) })

export const ISSUE_FIELDS = ["summary", "status", "issuetype", "priority", "assignee", "project", "created", "updated"]
