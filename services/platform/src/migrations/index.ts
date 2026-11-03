import type { Migrations } from "@mosaik/db"
import initial from "./0001_initial"
import appSettings from "./0002_app_settings"
import storage from "./0003_storage"
import portalPages from "./0004_portal_pages"

export const migrations: Migrations = {
  "0001_initial": initial,
  "0002_app_settings": appSettings,
  "0003_storage": storage,
  "0004_portal_pages": portalPages,
}
