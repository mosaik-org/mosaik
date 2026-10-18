import { defineSearchProvider } from "@mosaik/sdk/portal"
import { issues } from "../manifest"
import { issuesApi } from "./queries"

/** Finds Jira issues by key or text from the command palette. */
export default defineSearchProvider({
  id: "issues-jira",
  group: "Jira issues",
  permission: issues.accessPermission,
  minQueryLength: 3,
  search: async (query) => {
    const { data } = await issuesApi((client) => client.issues.list({ query: { q: query } }))
    return data.issues.slice(0, 6).map((issue) => ({
      id: issue.key,
      title: `${issue.key} · ${issue.summary}`,
      subtitle: `${issue.status} · ${issue.assignee ?? "Unassigned"}`,
      to: `/issues?q=${encodeURIComponent(issue.key)}`,
    }))
  },
})
