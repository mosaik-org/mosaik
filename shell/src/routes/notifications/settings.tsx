import { signInUrl } from "@mosaik/auth/contract"
import { sessionQueryOptions, usePrincipal } from "@mosaik/auth/web"
import { errorMessage } from "@mosaik/client"
import type { PersonalChannel } from "@mosaik/core"
import type { NotificationSettings, NotificationTypeSettings } from "@mosaik/notifications/contract"
import { css } from "@mosaik/styled-system/css"
import { Card, CardHeader, EmptyState, PageHeader, Switch, toast } from "@mosaik/ui"
import { QueryBoundary } from "@mosaik/web-kit"
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query"
import { createFileRoute, redirect } from "@tanstack/solid-router"
import BellOff from "lucide-solid/icons/bell-off"
import Settings from "lucide-solid/icons/settings"
import { For, Show } from "solid-js"
import { sourceName } from "../../apps"
import { notificationKeys, notificationsApi, settingsQuery } from "../../notifications/api"

export const Route = createFileRoute("/_app/notifications/settings")({
  staticData: { title: "Notification settings", keywords: ["email", "slack", "preferences", "mute"] },
  beforeLoad: async ({ context, location }) => {
    const { principal } = await context.queryClient.ensureQueryData(sessionQueryOptions())
    if (!principal.isAuthenticated) throw redirect({ href: signInUrl(location.href), reloadDocument: true })
  },
  component: SettingsPage,
})

const CHANNELS: ReadonlyArray<{ value: PersonalChannel; label: string }> = [
  { value: "inApp", label: "In app" },
  { value: "email", label: "E-mail" },
  { value: "slack", label: "Slack" },
]

const styles = {
  row: css({
    display: "grid",
    gridTemplateColumns: { base: "1fr", sm: "1fr auto" },
    alignItems: "center",
    gap: { base: "3", sm: "6" },
    py: "3",
    borderTopWidth: "1px",
    borderColor: "border.default",
  }),
  switches: css({ display: "flex", gap: "5", flexWrap: "wrap" }),
}

const TypeRow = (props: { type: NotificationTypeSettings; available: ReadonlyArray<PersonalChannel> }) => {
  const queryClient = useQueryClient()
  const update = useMutation(() => ({
    mutationFn: (input: { channel: PersonalChannel; enabled: boolean }) =>
      notificationsApi((client) => client.settings.set({ payload: { type: props.type.key, ...input } })),
    onMutate: async (input) => {
      // Flip the switch right away; the response (or a refetch on error) settles it.
      await queryClient.cancelQueries({ queryKey: notificationKeys.settings })
      queryClient.setQueryData<NotificationSettings>(notificationKeys.settings, (settings) =>
        settings === undefined
          ? settings
          : {
              ...settings,
              types: settings.types.map((type) =>
                type.key === props.type.key
                  ? { ...type, channels: { ...type.channels, [input.channel]: input.enabled } }
                  : type,
              ),
            },
      )
    },
    onError: (error: unknown) => {
      toast.error("Could not save the setting", errorMessage(error))
      void queryClient.invalidateQueries({ queryKey: notificationKeys.settings })
    },
  }))

  return (
    <div class={styles.row}>
      <div class={css({ fontSize: "sm" })}>{props.type.description}</div>
      <div class={styles.switches}>
        <For each={CHANNELS.filter((channel) => props.available.includes(channel.value))}>
          {(channel) => (
            <Switch
              label={channel.label}
              checked={props.type.channels[channel.value]}
              onCheckedChange={(enabled) => update.mutate({ channel: channel.value, enabled })}
            />
          )}
        </For>
      </div>
    </div>
  )
}

function SettingsPage() {
  const principal = usePrincipal()
  const settings = useQuery(settingsQuery)
  const bySource = (types: ReadonlyArray<NotificationTypeSettings>) =>
    [...new Set(types.map((type) => type.source))].map((source) => ({
      source,
      types: types.filter((type) => type.source === source),
    }))

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "6", maxW: "3xl" })}>
      <PageHeader
        icon={<Settings size={22} />}
        title="Notification settings"
        description="Choose where you get each kind of notification. You only get the ones meant for you."
      />
      <QueryBoundary query={settings}>
        {(data) => (
          <>
            <p class={css({ fontSize: "sm", color: "fg.muted" })}>
              <Show when={data().available.includes("email")}>E-mails go to {principal().user?.email}. </Show>
              <Show when={data().available.includes("slack")}>
                Slack messages go to the Slack account with that e-mail address.
              </Show>
            </p>
            <For
              each={bySource(data().types)}
              fallback={
                <Card>
                  <EmptyState icon={<BellOff size={24} />} title="No app sends notifications yet" />
                </Card>
              }
            >
              {(group) => (
                <Card>
                  <CardHeader title={sourceName(group.source)} />
                  <div>
                    <For each={group.types}>{(type) => <TypeRow type={type} available={data().available} />}</For>
                  </div>
                </Card>
              )}
            </For>
          </>
        )}
      </QueryBoundary>
    </div>
  )
}
