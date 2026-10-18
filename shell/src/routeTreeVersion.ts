import { createSignal } from "solid-js"

/**
 * Changes when installed apps' routes join the route tree (on first open), so what is
 * built from the routes (the command palette's pages) follows.
 */
export const [routeTreeVersion, setRouteTreeVersion] = createSignal(0)
