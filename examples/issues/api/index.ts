import { AccessControl, AgentTool, Fresh, UpstreamError } from "@mosaik/sdk"
import { JiraIssue, JiraProject, StatusCategory } from "@mosaik/sdk/connectors/jira/model"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { issues } from "../manifest"

/** Filters of the issues page; the same schema is the API query and the URL search params. */
export const IssuesSearch = Schema.Struct({
  project: Schema.optional(Schema.String.check(Schema.isPattern(/^[A-Z][A-Z0-9_]{0,19}$/))),
  /** Defaults to open issues (to do + in progress). */
  category: Schema.optional(StatusCategory),
  q: Schema.optional(Schema.String.check(Schema.isMaxLength(100))),
})
export type IssuesSearch = typeof IssuesSearch.Type

export class IssueList extends Schema.Class<IssueList>("@mosaik/issues/IssueList")({
  issues: Schema.Array(JiraIssue),
  /** More issues matched than were loaded. */
  truncated: Schema.Boolean,
}) {}

export class IssuesGroup extends HttpApiGroup.make("issues").add(
  HttpApiEndpoint.get("list", "/issues", {
    query: IssuesSearch.fields,
    success: Fresh(IssueList),
    error: UpstreamError,
  }).annotate(AgentTool, {
    title: "Find Jira issues",
    examples: ["Which issues are in progress right now?", "Show me the open bugs"],
    description:
      "Jira issues, open ones (to do and in progress) unless `category` says otherwise. `project` is a " +
      'project key, as "Jira projects" lists them; `q` searches the text. `truncated`: more matched than were returned.',
  }),
  HttpApiEndpoint.get("projects", "/projects", {
    success: Fresh(Schema.Array(JiraProject)),
    error: UpstreamError,
  }).annotate(AgentTool, { title: "Jira projects", description: "The Jira projects, with their keys and names." }),
) {}

export class IssuesApi extends HttpApi.make("issues")
  .add(IssuesGroup)
  .prefix(issues.apiPrefix)
  .middleware(AccessControl) {}

export { JiraIssue, JiraProject, StatusCategory }
