/** `@mosaik/sdk/solid`: who is signed in, the API (queries, actions), forms and live data, in Solid pages (Core). */
export { Can, useCan, usePrincipal, useSession } from "@mosaik/auth/web"
export {
  createEventStream,
  createQueryClient,
  type EventStream,
  type EventStreamStatus,
  type QueryClientOptions,
} from "@mosaik/client/solid"
export {
  type Action,
  type ActionOptions,
  type ContractApi,
  createApi,
  createDebounced,
  createForm,
  type EndpointApi,
  type FieldBinding,
  type Form,
  type FormOptions,
  type GroupApi,
  type Keyed,
  useAction,
  useNow,
} from "@mosaik/web-kit"
