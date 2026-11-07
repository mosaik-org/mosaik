import { defineApp } from "@mosaik/sdk"

/**
 * An app with its own UI: Mosaik gives it a database, sign-in, permissions and audit, and nothing on
 * its page comes from Mosaik. No `portal` section: the shell does not list it.
 */
export const links = defineApp({
  id: "links",
  name: "Links",
  description: "Useful links for the team, on a page of its own.",
  access: "view",
  database: true,
  permissions: {
    view: { description: "See the links", defaultRoles: ["authenticated"] },
    "links.add": { description: "Add links", defaultRoles: ["authenticated"] },
    "links.remove": { description: "Remove anyone's links", dangerous: true },
  },
  roles: {
    curator: { name: "Curator", description: "Adds links and removes anyone's", grants: ["links.*"] },
  },
})

export default links
