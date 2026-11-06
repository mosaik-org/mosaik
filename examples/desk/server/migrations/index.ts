import type { Migrations } from "@mosaik/sdk/server"
import desk from "./0001_desk"
import demoData from "./0002_demo_data"

export const migrations: Migrations = {
  "0001_desk": desk,
  "0002_demo_data": demoData,
}
