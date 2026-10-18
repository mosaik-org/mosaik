import type { Principal } from "@mosaik/core"
import { useQuery } from "@tanstack/solid-query"
import { type Accessor, createMemo, type JSX, Show } from "solid-js"
import { ANONYMOUS, sessionQueryOptions } from "./session"

export const useSession = () => useQuery(sessionQueryOptions)

/** The current principal; anonymous (no grants) until the session has loaded. */
export const usePrincipal = (): Accessor<Principal> => {
  const session = useSession()
  return createMemo(() => session.data?.principal ?? ANONYMOUS)
}

/** `const can = useCan(); can(sales.perm("orders.refund"))` */
export const useCan = (): ((permission: string) => boolean) => {
  const principal = usePrincipal()
  return (permission) => principal().can(permission)
}

/**
 * Renders children only when the principal holds `permission`. UI convenience only:
 * the API enforces the same permission.
 */
export const Can = (props: { permission: string; fallback?: JSX.Element; children: JSX.Element }) => {
  const can = useCan()
  return (
    <Show when={can(props.permission)} fallback={props.fallback}>
      {props.children}
    </Show>
  )
}
