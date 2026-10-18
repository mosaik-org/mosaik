/** `@mosaik/sdk/solid`: who is signed in and live data, in Solid pages (Core). */
export { Can, useCan, usePrincipal, useSession } from "@mosaik/auth/web"
export {
  createEventStream,
  createQueryClient,
  type EventStream,
  type EventStreamStatus,
  type QueryClientOptions,
} from "@mosaik/client/solid"
export { createDebounced, useNow } from "@mosaik/web-kit"
