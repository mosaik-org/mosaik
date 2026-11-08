import type { Migrations } from "@mosaik/db"
import initial from "./0001_initial"
import inbox from "./0002_inbox"
import inboxHistory from "./0003_inbox_history"

export const migrations: Migrations = {
  "0001_initial": initial,
  "0002_inbox": inbox,
  "0003_inbox_history": inboxHistory,
}
