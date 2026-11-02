import type { Migrations } from "@mosaik/db"
import initial from "./0001_initial"
import agents from "./0002_agents"

export const migrations: Migrations = {
  "0001_initial": initial,
  "0002_agents": agents,
}
