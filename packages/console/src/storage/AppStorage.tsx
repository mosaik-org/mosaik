import { usePrincipal } from "@mosaik/auth/web"
import { errorMessage, formatBytes, formatNumber, toast } from "@mosaik/client"
import { Button, Card, NumberField, Progress } from "@mosaik/mosaik-ui"
import { AccessAdmin, type StorageUsage } from "@mosaik/platform/contract"
import { css } from "@mosaik/styled-system/css"
import { QueryBoundary } from "@mosaik/web-kit"
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/solid-query"
import { createSignal, Show } from "solid-js"
import { platformApi } from "../api"

const GB = 1024 ** 3

/** Per user, so another account on the same browser never sees them. */
export const storageKeys = {
  app: (user: string, app: string) => ["storage", user, app] as const,
}

/**
 * How much an app stores, for the people who manage it. Fails with `StorageUnavailable` when the
 * app stores no files (or the platform has none): the page then shows no Storage tab.
 */
export const appStorageQuery = (user: string, app: string) =>
  queryOptions({
    queryKey: storageKeys.app(user, app),
    queryFn: () => platformApi((client) => client.storage.usage({ params: { id: app } })),
    retry: false,
  })

const styles = {
  stack: css({ display: "flex", flexDirection: "column", gap: "5" }),
  numbers: css({ display: "flex", justifyContent: "space-between", fontSize: "sm", color: "fg.muted" }),
  limit: css({ display: "flex", alignItems: "flex-end", gap: "2", maxW: "md" }),
}

/** An app's files: how much it stores against its limit, which admins change. */
export const AppStorageTab = (props: { user: string; app: string; appName: string }) => {
  const query = useQuery(() => appStorageQuery(props.user, props.app))
  return <QueryBoundary query={query}>{(usage) => <StorageCard {...props} usage={usage()} />}</QueryBoundary>
}

const StorageCard = (props: { user: string; app: string; appName: string; usage: StorageUsage }) => {
  const principal = usePrincipal()
  const queryClient = useQueryClient()
  const isAdmin = () => principal().can(AccessAdmin.manage)
  /** The limit being edited, in GB; `undefined` while it shows the current one. */
  const [limit, setLimit] = createSignal<number | null>()
  const shownLimit = () => limit() ?? props.usage.limitBytes / GB
  const share = () => (props.usage.limitBytes === 0 ? 1 : Math.min(1, props.usage.usedBytes / props.usage.limitBytes))

  const save = useMutation(() => ({
    mutationFn: (limitBytes: number | null) =>
      platformApi((client) => client.storage.setLimit({ params: { id: props.app }, payload: { limitBytes } })),
    onSuccess: (usage: StorageUsage) => {
      queryClient.setQueryData(storageKeys.app(props.user, props.app), usage)
      setLimit(undefined)
      toast.success("Limit saved", `${props.appName} may store ${formatBytes(usage.limitBytes)}`)
    },
    onError: (error: unknown) => toast.error("Could not save the limit", errorMessage(error)),
  }))

  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Storage</Card.Title>
        <Card.Description>{`Files ${props.appName} keeps with the platform. Each app decides what it stores; the platform keeps it within its limit.`}</Card.Description>
      </Card.Header>
      <Card.Body>
        <div class={styles.stack}>
          <Progress.Root value={Math.round(share() * 100)} colorPalette={share() >= 0.9 ? "danger" : "accent"}>
            <Progress.Label>{`${formatBytes(props.usage.usedBytes)} of ${formatBytes(props.usage.limitBytes)}`}</Progress.Label>
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
          <div class={styles.numbers}>
            <span>{`${formatNumber(props.usage.objects)} ${props.usage.objects === 1 ? "file" : "files"}`}</span>
            <span>{props.usage.defaultLimit ? "The platform's default limit" : "A limit of its own"}</span>
          </div>
          <Show when={isAdmin()}>
            <div class={styles.limit}>
              <NumberField
                label="Limit (GB)"
                min={0}
                step={1}
                value={shownLimit()}
                onValueChange={setLimit}
                disabled={save.isPending}
              />
              <Button
                loading={save.isPending}
                disabled={limit() === undefined || limit() === null}
                onClick={() => save.mutate(Math.round((limit() ?? 0) * GB))}
              >
                Save
              </Button>
              <Show when={!props.usage.defaultLimit}>
                <Button variant="plain" disabled={save.isPending} onClick={() => save.mutate(null)}>
                  Back to the default
                </Button>
              </Show>
            </div>
          </Show>
        </div>
      </Card.Body>
    </Card.Root>
  )
}
