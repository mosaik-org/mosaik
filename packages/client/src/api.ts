import { type QueryKey, queryOptions, useQueryClient } from "@tanstack/solid-query"
import type { Types } from "effect"
import type { HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { createSignal } from "solid-js"
import { type ApiClient, type BrowserApi, makeApiClient } from "./client"
import { errorMessage } from "./errors"
import { toast } from "./shell"

type Endpoint = HttpApiEndpoint.ConstraintRequest

/** What a call of the endpoint takes (nothing, for an endpoint without parameters, query or payload). */
type Request<E extends Endpoint> = Types.Simplify<
  HttpApiEndpoint.ClientRequest<E["~Params"], E["~Query"], E["~Payload"], E["~Headers"], "decoded-only">
>
// biome-ignore lint/suspicious/noConfusingVoidType: Effect types an endpoint without a request as `void | {}`.
type Args<E extends Endpoint> = void extends Request<E> ? [request?: Request<E>] : [request: Request<E>]
type Success<E extends Endpoint> = HttpApiClient.SuccessType<E["~Success"]>

/** Anything whose queries can be refetched together: the whole API, a group, an endpoint. */
export interface Keyed {
  /** The query key every query under it starts with. */
  key(): QueryKey
}

/** One endpoint of an API contract: its queries and calls. */
export interface EndpointApi<E extends Endpoint> extends Keyed {
  /** Query options for `useQuery`, keyed by the endpoint and the request. */
  query(...request: Args<E>): ReturnType<typeof queryOptions<Success<E>, Error, Success<E>, QueryKey>>
  /** Calls the endpoint; fails with the API's typed error (see `errorMessage`, `errorTag`). */
  call(...request: Args<E>): Promise<Success<E>>
}

type Endpoints<G extends HttpApiGroup.Constraint> = G["endpoints"] extends infer Map extends Readonly<
  Record<string, Endpoint>
>
  ? Map
  : never

export type GroupApi<G extends HttpApiGroup.Constraint> = Keyed & {
  readonly [Id in keyof Endpoints<G>]: EndpointApi<Endpoints<G>[Id]>
}

/** An API contract for pages: per group and endpoint, query options with keys derived from the contract, and calls. */
export type ContractApi<Groups extends HttpApiGroup.Constraint> = Keyed & {
  readonly [G in Extract<Groups, { readonly topLevel: false }> as HttpApiGroup.Identifier<G>]: GroupApi<G>
} & {
  readonly [E in Extract<
    HttpApiGroup.Endpoints<Extract<Groups, { readonly topLevel: true }>>,
    Endpoint
  > as E["identifier"]]: EndpointApi<E>
}

/** Group and endpoint names `createApi` uses itself. */
const RESERVED = new Set(["key", "query", "call"])

/**
 * An API contract for pages. Queries are keyed by the contract (`[api, group, endpoint,
 * request]`), so nobody writes keys by hand, and refetching a group or an endpoint is one
 * `key()` away; with `useAction`, calls that change something show their outcome and
 * refetch what they affect.
 *
 * @example
 * const sales = createApi(SalesApi)
 * const orders = useQuery(() => sales.orders.list.query({ query: { page: 1 } }))
 * const refund = useAction(sales.orders.refund, { success: "Refunded", invalidates: [sales.orders] })
 */
export const createApi = <Id extends string, Groups extends HttpApiGroup.Constraint>(
  api: BrowserApi<Id, Groups>,
): ContractApi<Groups> => {
  const run: ApiClient<Groups> = makeApiClient(api)
  // The client's shape is the contract's; `ContractApi` types what pages see of it.
  type Client = Record<string, any>

  const endpoint = (prefix: QueryKey, pick: (client: Client) => (...request: ReadonlyArray<unknown>) => any) => {
    const call = (...request: ReadonlyArray<unknown>) => run((client) => pick(client as Client)(...request))
    return {
      key: () => prefix,
      call,
      query: (...request: ReadonlyArray<unknown>) =>
        queryOptions({
          queryKey: request.length === 0 ? prefix : [...prefix, request[0]],
          queryFn: () => call(...request),
        }),
    }
  }

  const root: Record<string, unknown> = { key: () => [api.identifier] }
  for (const group of Object.values(api.groups) as ReadonlyArray<HttpApiGroup.Top>) {
    const names = Object.keys(group.endpoints)
    for (const name of [group.identifier, ...names]) {
      if (RESERVED.has(name)) throw new Error(`"${name}" in ${api.identifier} clashes with createApi's own names`)
    }
    if (group.topLevel) {
      for (const name of names) root[name] = endpoint([api.identifier, name], (client) => client[name])
      continue
    }
    const prefix = [api.identifier, group.identifier]
    root[group.identifier] = Object.fromEntries([
      ["key", () => prefix],
      ...names.map((name) => [name, endpoint([...prefix, name], (client) => client[group.identifier][name])]),
    ])
  }
  return root as ContractApi<Groups>
}

export interface ActionOptions<A, Request extends ReadonlyArray<unknown>> {
  /** A toast when it worked: a title, or one made from the answer and the request. */
  readonly success?: string | ((value: A, ...request: Request) => string)
  /** The title of the toast when it failed (with `run`); the API's message is its text. */
  readonly failure?: string
  /** What to refetch afterwards: the whole API, a group or an endpoint (anything with `key()`). */
  readonly invalidates?: ReadonlyArray<Keyed>
  /** After it worked, and after the toast and the refetching started. */
  readonly onSuccess?: (value: A, ...request: Request) => void
}

/** A call that changes something, from a page. */
export interface Action<A, Request extends ReadonlyArray<unknown>> {
  /** For buttons and menus: a failure is shown as a toast; resolves to whether it worked (e.g. to close a dialog). */
  run(...request: Request): Promise<boolean>
  /** For forms (`createForm`'s `onSubmit`): a failure is thrown, so the form shows it. */
  submit(...request: Request): Promise<A>
  /** Whether a call is running. */
  readonly pending: () => boolean
}

/**
 * Calls an endpoint that changes something, with what every such call needs: a toast with
 * the outcome, refetching what it affects, and whether it is still running.
 *
 * @example
 * const refund = useAction(sales.orders.refund, {
 *   success: (order) => `${order.number} was refunded`,
 *   invalidates: [sales.orders],
 * })
 * <Button loading={refund.pending()} onClick={() => void refund.run({ params: { id }, payload })}>Refund</Button>
 */
export const useAction = <E extends Endpoint>(
  endpoint: EndpointApi<E>,
  options: ActionOptions<Success<E>, Args<E>> = {},
): Action<Success<E>, Args<E>> => {
  const queryClient = useQueryClient()
  const [running, setRunning] = createSignal(0)

  const submit = async (...request: Args<E>) => {
    setRunning((count) => count + 1)
    try {
      const value = await endpoint.call(...request)
      if (options.success !== undefined) {
        toast.success(typeof options.success === "string" ? options.success : options.success(value, ...request))
      }
      for (const target of options.invalidates ?? []) void queryClient.invalidateQueries({ queryKey: target.key() })
      options.onSuccess?.(value, ...request)
      return value
    } finally {
      setRunning((count) => count - 1)
    }
  }

  return {
    submit,
    run: (...request) =>
      submit(...request).then(
        () => true,
        (error: unknown) => {
          toast.error(options.failure ?? "That did not work", errorMessage(error))
          return false
        },
      ),
    pending: () => running() > 0,
  }
}
