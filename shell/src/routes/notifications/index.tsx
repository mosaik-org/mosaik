import { signInUrl } from "@mosaik/auth/contract"
import { sessionQueryOptions } from "@mosaik/auth/web"
import { createListNavigation, searchValidator } from "@mosaik/client/solid"
import { type Command, PageTitle, useCommands } from "@mosaik/frame"
import { Button, Card, EmptyState, Tabs } from "@mosaik/mosaik-ui"
import { InboxState } from "@mosaik/notifications/contract"
import { css } from "@mosaik/styled-system/css"
import { QueryBoundary } from "@mosaik/web-kit"
import { useInfiniteQuery } from "@tanstack/solid-query"
import { createFileRoute, Link, redirect } from "@tanstack/solid-router"
import { Schema } from "effect"
import Bell from "lucide-solid/icons/bell"
import BellOff from "lucide-solid/icons/bell-off"
import Settings from "lucide-solid/icons/settings"
import { For, Show } from "solid-js"
import { useInboxActions } from "../../notifications/actions"
import { inboxQuery } from "../../notifications/api"
import { type Grouping, inListOrder, NotificationList, resolveLabel } from "../../notifications/NotificationList"
import { snoozeChoices } from "../../notifications/snooze"

const InboxSearch = Schema.Struct({ state: Schema.optional(InboxState) })

export const Route = createFileRoute("/_app/notifications/")({
  staticData: { title: "Notifications", keywords: ["inbox", "alerts", "to do", "snoozed", "resolved"] },
  validateSearch: searchValidator(InboxSearch),
  beforeLoad: async ({ context, location }) => {
    const { principal } = await context.queryClient.ensureQueryData(sessionQueryOptions())
    if (!principal.isAuthenticated) throw redirect({ href: signInUrl(location.href), reloadDocument: true })
  },
  component: NotificationsPage,
})

const TABS: ReadonlyArray<{ readonly value: InboxState; readonly label: string }> = [
  { value: "open", label: "Open" },
  { value: "snoozed", label: "Snoozed" },
  { value: "resolved", label: "Resolved" },
]

const EMPTY: Record<InboxState, { readonly title: string; readonly description: string }> = {
  open: { title: "You're all caught up", description: "Apps put here what needs you, and what you should know." },
  snoozed: { title: "Nothing snoozed", description: "What you put away comes back here, unread, when its time comes." },
  resolved: { title: "Nothing resolved lately", description: "Resolved items stay here for 30 days." },
}

const LIST = "In the inbox"

/** The person's inbox: what is open, snoozed or resolved, worked through by mouse or keyboard. */
function NotificationsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const state = () => search().state ?? "open"
  const inbox = useInfiniteQuery(() => inboxQuery(state()))
  const actions = useInboxActions()
  const grouping = (): Grouping => (state() === "open" ? "kind" : "day")
  // In the order shown, so that moving down goes to the next row on screen.
  const items = () => inListOrder(inbox.data?.pages.flatMap((page) => page.items) ?? [], grouping())
  const counts = () => inbox.data?.pages[0]?.counts

  const list = createListNavigation({ items, id: (item) => String(item.id), label: "Notifications" })

  /** On what is marked if anything is, otherwise on where the person is. */
  const onTargets = (use: (targets: ReturnType<typeof list.targets>) => void) => () => {
    const targets = list.targets()
    if (targets.length > 0) use(targets)
  }
  const tomorrow = () => snoozeChoices(new Date()).find((choice) => choice.id === "tomorrow")

  useCommands(() => [
    {
      id: "inbox:next",
      title: "Next",
      group: LIST,
      keys: ["j", "arrowdown"],
      repeats: true,
      unlisted: true,
      perform: () => list.move(1),
    },
    {
      id: "inbox:previous",
      title: "Previous",
      group: LIST,
      keys: ["k", "arrowup"],
      repeats: true,
      unlisted: true,
      perform: () => list.move(-1),
    },
    {
      id: "inbox:open",
      title: "Open",
      group: LIST,
      keys: "enter",
      unlisted: true,
      perform: () => {
        const item = list.activeItem()
        if (item !== undefined) actions.open(item)
      },
    },
    ...(state() === "open"
      ? ([
          {
            id: "inbox:resolve",
            title: (() => {
              const active = list.activeItem()
              return active === undefined ? "Resolve" : resolveLabel(active)
            })(),
            group: LIST,
            keys: "e",
            perform: onTargets(actions.resolve),
          },
          {
            id: "inbox:snooze",
            title: "Snooze until tomorrow",
            group: LIST,
            keys: "h",
            perform: onTargets((targets) => {
              const choice = tomorrow()
              if (choice !== undefined) actions.snooze(targets, choice)
            }),
          },
          { id: "inbox:read", title: "Mark as read", group: LIST, keys: "u", perform: onTargets(actions.markRead) },
        ] satisfies ReadonlyArray<Command>)
      : [{ id: "inbox:reopen", title: "Open again", group: LIST, keys: "e", perform: onTargets(actions.reopen) }]),
  ])

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "6", maxW: "3xl" })}>
      <PageTitle
        title="Notifications"
        icon={<Bell size={18} />}
        actions={
          <>
            <Show when={state() === "open" && (counts()?.unread ?? 0) > 0}>
              <Button
                variant="outline"
                size="xs"
                loading={actions.markAllRead.isPending}
                onClick={() => actions.markAllRead.mutate()}
              >
                Mark all as read
              </Button>
            </Show>
            <Button
              variant="plain"
              size="xs"
              asChild={(link) => (
                <Link to="/notifications/settings" {...link()}>
                  <Settings size={16} />
                  Settings
                </Link>
              )}
            />
          </>
        }
      />
      <Tabs.Root
        value={state()}
        onValueChange={({ value }) =>
          void navigate({ search: { state: value === "open" ? undefined : (value as InboxState) } })
        }
      >
        <Tabs.List>
          <For each={TABS}>
            {(tab) => (
              <Tabs.Trigger value={tab.value}>
                {tab.value === "open" && (counts()?.actions ?? 0) > 0
                  ? `${tab.label} (${counts()?.actions} to do)`
                  : tab.label}
              </Tabs.Trigger>
            )}
          </For>
        </Tabs.List>
      </Tabs.Root>
      <QueryBoundary query={inbox}>
        {() => (
          <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
            <Card.Root>
              <NotificationList
                items={items()}
                grouping={grouping()}
                actions={actions}
                navigation={list}
                onOpen={actions.open}
                empty={<EmptyState icon={<BellOff size={24} />} {...EMPTY[state()]} />}
              />
            </Card.Root>
            <Show when={inbox.hasNextPage}>
              <div class={css({ display: "flex", justifyContent: "center" })}>
                <Button variant="outline" loading={inbox.isFetchingNextPage} onClick={() => void inbox.fetchNextPage()}>
                  Load older
                </Button>
              </div>
            </Show>
          </div>
        )}
      </QueryBoundary>
    </div>
  )
}
