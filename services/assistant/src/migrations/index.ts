import type { Migrations } from "@mosaik/db"
import initial from "./0001_initial"
import waitingChanges from "./0002_waiting_changes"

export const migrations: Migrations = {
  "0001_initial": initial,
  "0002_waiting_changes": waitingChanges,
}
