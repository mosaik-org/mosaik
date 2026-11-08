import type { Migrations } from "@mosaik/db"
import initial from "./0001_initial"
import inbox from "./0002_inbox"

export const migrations: Migrations = {
  "0001_initial": initial,
  "0002_inbox": inbox,
}
