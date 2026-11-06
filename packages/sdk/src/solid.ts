/**
 * `@mosaik/sdk/solid`: who is signed in, the API (queries, actions), forms and live data, in Solid pages
 * (Core); `<Toasts />` and `usePageTheme` for the shell's contract (`toast`, `pageTheme` in `/client`).
 */
export { Can, useCan, usePrincipal, useSession } from "@mosaik/auth/web"
export {
  createEventStream,
  createQueryClient,
  type EventStream,
  type EventStreamStatus,
  type QueryClientOptions,
  useBusy,
  useStatus,
} from "@mosaik/client/solid"
export {
  type Action,
  type ActionOptions,
  type ContractApi,
  createApi,
  createDebounced,
  createForm,
  createListNavigation,
  type EndpointApi,
  type FieldBinding,
  type Form,
  type FormOptions,
  type GroupApi,
  type Keyed,
  type ListNavigation,
  type ListNavigationOptions,
  Toasts,
  useAction,
  useNow,
  usePageTheme,
} from "@mosaik/web-kit"
