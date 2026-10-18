/**
 * `@mosaik/sdk/client`: calling APIs from a page, whatever it is built with (Core). Requests
 * go to the page's origin: the gateway (mounted apps) or the app's own backend (standalone).
 */
export { AuthProviders, IdentityApi, SessionInfo } from "@mosaik/auth/contract"
export * from "@mosaik/client"
