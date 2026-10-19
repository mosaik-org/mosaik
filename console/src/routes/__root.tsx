import { errorMessage } from "@mosaik/client"
import { ErrorState } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import type { QueryClient } from "@tanstack/solid-query"
import { createRootRouteWithContext, Outlet } from "@tanstack/solid-router"

/** The same context as the shell's: the console's pages read it (e.g. to load the session). */
export interface RouterContext {
  readonly queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  errorComponent: (props) => (
    <div class={css({ maxWidth: "lg", mx: "auto", py: "24", px: "4" })}>
      <ErrorState message={errorMessage(props.error)} onRetry={props.reset} />
    </div>
  ),
})
