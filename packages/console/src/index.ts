/**
 * The console: Core's web UI for running Mosaik and deciding who can use apps. Its pages
 * (`routes/`) are mounted by two hosts: the console app (`console/`) when Mosaik runs without
 * the Portal, and the Portal's shell, which adds its parts through `ConsoleExtensions`. Both
 * mount them under an `_app` layout at the same paths, so Core's links work either way.
 */
export { AppOwners, AppRoles } from "./access/About"
export { aboutQuery, accessKeys, managesAnyApp, reviewsQuery } from "./access/queries"
export { RoleDetails } from "./access/RoleDetails"
export { type AppTab, type ConsoleExtensions, ConsoleExtensionsProvider, useConsoleExtensions } from "./extensions"
export { type ConsoleNavItem, canUseConsole, consoleNav } from "./gate"
