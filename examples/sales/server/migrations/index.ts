import type { Migrations } from "@mosaik/sdk/server"
import orders from "./0001_orders"
import demoData from "./0002_demo_data"

export const migrations: Migrations = {
  "0001_orders": orders,
  "0002_demo_data": demoData,
}
