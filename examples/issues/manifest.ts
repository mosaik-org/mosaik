import { defineApp } from "@mosaik/sdk"

export const issues = defineApp({
  id: "issues",
  name: "Issues",
  description: "Open Jira issues across projects.",
  access: "view",
  permissions: {
    view: { description: "View Jira issues", defaultRoles: ["authenticated"] },
  },
  portal: {
    icon: "file-text",
    category: "Engineering",
    // Without JIRA_URL (outside production) the app serves sample data.
    config: {
      JIRA_URL: { description: "Jira base URL, e.g. https://acme.atlassian.net", required: false },
      JIRA_TOKEN: { description: "Data Center / Server: personal access token", required: false, secret: true },
      JIRA_EMAIL: { description: "Cloud: the account's e-mail", required: false },
      JIRA_API_TOKEN: { description: "Cloud: API token", required: false, secret: true },
      JIRA_FLAVOR: { description: "cloud or datacenter (detected from the URL when empty)", required: false },
    },
  },
})

export default issues
