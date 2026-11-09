import { errorMessage } from "@mosaik/client"
import { isChunkLoadError } from "@mosaik/frame"
import { css } from "@mosaik/styled-system/css"
import { ErrorState } from "@mosaik/web-kit"
import { type ErrorComponentProps, useLocation, useRouter } from "@tanstack/solid-router"
import { Match, Switch } from "solid-js"
import { appForPath } from "../apps"

/** An installed app's code could not be loaded: the app is down, or its bundle is broken. */
export class AppLoadError extends Error {
  constructor(
    readonly appName: string,
    cause: unknown,
  ) {
    super(
      isChunkLoadError(cause)
        ? "Its files could not be fetched: the app may be down or restarting."
        : errorMessage(cause),
      { cause },
    )
    this.name = "AppLoadError"
  }
}

/** The boundary renders again while a retry runs; each error is logged once. */
const logged = new WeakSet<object>()
const logOnce = (message: string, error: unknown) => {
  if (typeof error === "object" && error !== null) {
    if (logged.has(error)) return
    logged.add(error)
  }
  console.error(message, error)
}

/**
 * The router's error boundary for every route: shown in place of the route that failed,
 * so the shell, the app's navigation and the other apps keep working.
 */
export function AppError(props: ErrorComponentProps) {
  const router = useRouter()
  const app = appForPath(useLocation()().pathname)
  logOnce(app === undefined ? "Error in the shell" : `Error in the "${app.id}" app`, props.error)

  // Runs failed loaders and route guards again (an app that could not be loaded), then renders again.
  const retry = () => void router.invalidate().finally(() => props.reset())

  return (
    <div class={css({ maxWidth: "lg", mx: "auto", py: "16", px: "4" })}>
      <Switch
        fallback={
          <ErrorState
            {...(app === undefined ? {} : { title: `${app.name} ran into a problem` })}
            message={errorMessage(props.error)}
            onRetry={retry}
          />
        }
      >
        <Match when={props.error instanceof AppLoadError && props.error}>
          {(error) => (
            <ErrorState title={`${error().appName} could not be loaded`} message={error().message} onRetry={retry} />
          )}
        </Match>
        <Match when={isChunkLoadError(props.error)}>
          <ErrorState
            title="A new version is available"
            message="This page belongs to a version that has since been replaced. Reload the page to get the new one."
            retryLabel="Reload page"
            onRetry={() => window.location.reload()}
          />
        </Match>
      </Switch>
    </div>
  )
}
