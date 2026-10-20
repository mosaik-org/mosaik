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
      JIRA_URL: {
        label: "Jira address",
        kind: "url",
        description: "Jira base URL, e.g. https://acme.atlassian.net",
        required: false,
      },
      JIRA_TOKEN: {
        label: "Personal access token",
        description: "Data Center / Server: personal access token",
        required: false,
        secret: true,
      },
      JIRA_EMAIL: { label: "Account e-mail", description: "Cloud: the account's e-mail", required: false },
      JIRA_API_TOKEN: { label: "API token", description: "Cloud: API token", required: false, secret: true },
      JIRA_FLAVOR: {
        label: "Jira flavor",
        description: "cloud or datacenter (detected from the URL when empty)",
        required: false,
      },
    },
  },
})

export default issues
