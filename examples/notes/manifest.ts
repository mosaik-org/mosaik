import { defineApp } from "@mosaik/sdk"

/**
 * A standalone app: it runs on its own address with its own page, and uses Core (sign-in,
 * roles, audit, notifications) without the Portal. No `portal` section: the shell does not
 * list it.
 */
export const notes = defineApp({
  id: "notes",
  name: "Notes",
  description: "Short notes for the team, on their own page.",
  access: "view",
  permissions: {
    view: { description: "Read notes", defaultRoles: ["authenticated"] },
    "notes.write": { description: "Write notes", defaultRoles: ["authenticated"] },
    "notes.delete": { description: "Delete anyone's notes", dangerous: true },
  },
  roles: {
    writer: { name: "Writer", description: "Reads and writes notes", grants: ["notes.write"] },
    moderator: { name: "Moderator", description: "Also deletes anyone's notes", grants: ["notes.*"] },
  },
  notifications: {
    "note.posted": { description: "Someone posted a note" },
  },
})

export default notes
