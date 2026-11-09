import { errorMessage, formatRelativeTime, toast } from "@mosaik/client"
import { fromSettingDeclaration, settingProblem } from "@mosaik/core"
import type { AppSettingState, AppSettings, AppSettingsChange } from "@mosaik/platform/contract"
import { css } from "@mosaik/styled-system/css"
import { Button, Card } from "@mosaik/ui"
import { QueryBoundary, SettingField } from "@mosaik/web-kit"
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/solid-query"
import { createMemo, createSignal, For, Show } from "solid-js"
import { platformApi } from "../api"

/** Per user, so another account on the same browser never sees them. */
export const settingsKeys = {
  app: (user: string, app: string) => ["settings", user, app] as const,
}

/** An app's settings, for the people who manage it. */
export const appSettingsQuery = (user: string, app: string) =>
  queryOptions({
    queryKey: settingsKeys.app(user, app),
    queryFn: () => platformApi((client) => client.settings.get({ params: { id: app } })),
  })

const styles = {
  stack: css({ display: "flex", flexDirection: "column", gap: "5" }),
  setting: css({ display: "flex", flexDirection: "column", gap: "1.5" }),
  meta: css({ display: "flex", alignItems: "center", gap: "2", fontSize: "xs", color: "fg.muted", minH: "6" }),
  outdated: css({ fontSize: "xs", color: "warning.fg" }),
  footer: css({ display: "flex", justifyContent: "flex-end", gap: "2" }),
}

/**
 * An app's settings, from its manifest: each one's value, who changed it, and a way back to the
 * default. Saved values apply at once: the app reads them while it runs.
 */
export const AppSettingsTab = (props: { user: string; app: string; appName: string }) => {
  const query = useQuery(() => appSettingsQuery(props.user, props.app))
  return <QueryBoundary query={query}>{(settings) => <SettingsForm {...props} settings={settings()} />}</QueryBoundary>
}

const SettingsForm = (props: { user: string; app: string; appName: string; settings: AppSettings }) => {
  const queryClient = useQueryClient()
  /** Edited values by name; the rest show what the app reads. */
  const [draft, setDraft] = createSignal<Readonly<Record<string, unknown>>>({})
  const shown = (state: AppSettingState) =>
    state.declaration.name in draft() ? draft()[state.declaration.name] : state.value
  const problems = createMemo(() =>
    Object.fromEntries(
      props.settings.settings.flatMap((state) => {
        const problem = settingProblem(fromSettingDeclaration(state.declaration), shown(state))
        return problem === undefined ? [] : [[state.declaration.name, problem]]
      }),
    ),
  )
  /** The edits that change something. */
  const changes = () =>
    Object.fromEntries(
      props.settings.settings
        .filter((state) => state.declaration.name in draft())
        .filter((state) => JSON.stringify(draft()[state.declaration.name]) !== JSON.stringify(state.value))
        .map((state) => [state.declaration.name, draft()[state.declaration.name]]),
    )

  const save = useMutation(() => ({
    // Values as the fields give them (checked above); the platform checks them again.
    mutationFn: (values: Record<string, unknown>) =>
      platformApi((client) =>
        client.settings.set({ params: { id: props.app }, payload: { values: values as AppSettingsChange["values"] } }),
      ),
    onSuccess: (settings: AppSettings, values: Record<string, unknown>) => {
      queryClient.setQueryData(settingsKeys.app(props.user, props.app), settings)
      setDraft({})
      const reset = Object.values(values).every((value) => value === null)
      toast.success(reset ? "Back to the default" : "Settings saved", `${props.appName} uses them now`)
    },
    onError: (error: unknown) => toast.error("Could not save the settings", errorMessage(error)),
  }))

  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Settings</Card.Title>
        <Card.Description>{`How ${props.appName} behaves. Changes apply at once, without a restart.`}</Card.Description>
      </Card.Header>
      <Card.Body>
        <div class={styles.stack}>
          <For each={props.settings.settings}>
            {(state) => {
              const name = state.declaration.name
              const edited = () => name in draft()
              return (
                <div class={styles.setting}>
                  <SettingField
                    setting={fromSettingDeclaration(state.declaration)}
                    name={name}
                    value={shown(state)}
                    onValueChange={(value) => setDraft({ ...draft(), [name]: value })}
                    errorText={edited() ? problems()[name] : undefined}
                    disabled={save.isPending}
                  />
                  <Show when={state.outdated}>
                    <p class={styles.outdated}>
                      The value chosen earlier no longer fits this version of the app: the default applies.
                    </p>
                  </Show>
                  <div class={styles.meta}>
                    <Show when={state.changedAt} fallback={<span>Default</span>}>
                      {(at) => (
                        <>
                          <span>{`Changed by ${state.changedBy} ${formatRelativeTime(at())}`}</span>
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={save.isPending}
                            onClick={() => save.mutate({ [name]: null })}
                          >
                            Back to the default
                          </Button>
                        </>
                      )}
                    </Show>
                  </div>
                </div>
              )
            }}
          </For>
        </div>
      </Card.Body>
      <Card.Footer class={styles.footer}>
        <Show when={Object.keys(draft()).length > 0}>
          <Button variant="ghost" disabled={save.isPending} onClick={() => setDraft({})}>
            Discard changes
          </Button>
        </Show>
        <Button
          loading={save.isPending}
          disabled={Object.keys(changes()).length === 0 || Object.keys(problems()).length > 0}
          onClick={() => save.mutate(changes())}
        >
          Save
        </Button>
      </Card.Footer>
    </Card.Root>
  )
}
