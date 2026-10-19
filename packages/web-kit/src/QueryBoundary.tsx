import { errorMessage } from "@mosaik/client"
import { ErrorState, Spinner } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { type Accessor, type JSX, Match, Switch } from "solid-js"

/** The parts of a (regular or infinite) TanStack query result the boundary needs. */
export interface QueryState<T> {
  readonly data: T | undefined
  readonly isSuccess: boolean
  readonly isError: boolean
  readonly error: unknown
  refetch(): unknown
}

export interface QueryBoundaryProps<T> {
  readonly query: QueryState<T>
  /** Rendered while the first load is in progress. Defaults to a centered spinner. */
  readonly loading?: JSX.Element
  readonly children: (data: Accessor<T>) => JSX.Element
}

const center = css({ display: "flex", justifyContent: "center", py: "16" })

/**
 * Renders a query's loading, error (with retry) and success states.
 * Keeps showing data during background refetches.
 */
export const QueryBoundary = <T,>(props: QueryBoundaryProps<T>) => (
  <Switch>
    <Match when={props.query.isSuccess || props.query.data !== undefined}>
      {props.children(() => props.query.data as T)}
    </Match>
    <Match when={props.query.isError}>
      <ErrorState message={errorMessage(props.query.error)} onRetry={() => void props.query.refetch()} />
    </Match>
    <Match when={true}>
      {props.loading ?? (
        <div class={center}>
          <Spinner size="lg" />
        </div>
      )}
    </Match>
  </Switch>
)
