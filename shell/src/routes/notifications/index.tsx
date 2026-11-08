import { signInUrl } from "@mosaik/auth/contract"
import { sessionQueryOptions } from "@mosaik/auth/web"
import { createListNavigation, searchValidator } from "@mosaik/client/solid"
import { type Command, FRAME_TOP, PageTitle, useCommands } from "@mosaik/frame"
import { ActionMenu, Button, EmptyState, IconButton, SelectField, Spinner, Tabs } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { useInfiniteQuery } from "@tanstack/solid-query"
import { createFileRoute, redirect } from "@tanstack/solid-router"
import { Schema } from "effect"
import Bell from "lucide-solid/icons/bell"
import BellOff from "lucide-solid/icons/bell-off"
import CheckCheck from "lucide-solid/icons/check-check"
import Ellipsis from "lucide-solid/icons/ellipsis"
import Settings from "lucide-solid/icons/settings"
import { createEffect, createMemo, For, on, Show } from "solid-js"
import { sourceName } from "../../apps"
import { useInboxActions } from "../../notifications/actions"
import { viewQuery } from "../../notifications/api"
import { BulkBar } from "../../notifications/BulkBar"
import { InboxGrid } from "../../notifications/InboxGrid"
import {
  createArrivals,
  type InboxView,
  InboxView as InboxViewSchema,
  inListOrder,
  resolveLabel,
  sectionsOf,
  VIEWS,
} from "../../notifications/model"
import { ReadingPane } from "../../notifications/ReadingPane"
import { snoozeChoices } from "../../notifications/snooze"

/** Which list, of which app's items, and the item open beside it. */
const InboxSearch = Schema.Struct({
  view: Schema.optional(InboxViewSchema),
  app: Schema.optional(Schema.String),
  item: Schema.optional(Schema.Number),
})

export const Route = createFileRoute("/_app/notifications/")({
  staticData: {
    title: "Notifications",
    layout: "full",
    keywords: ["inbox", "alerts", "to do", "updates", "snoozed", "resolved"],
  },
  validateSearch: searchValidator(InboxSearch),
  beforeLoad: async ({ context, location }) => {
    const { principal } = await context.queryClient.ensureQueryData(sessionQueryOptions())
    if (!principal.isAuthenticated) throw redirect({ href: signInUrl(location.href), reloadDocument: true })
  },
  component: NotificationsPage,
})

const ORDER: ReadonlyArray<InboxView> = ["todo", "updates", "snoozed", "resolved"]
const ALL_APPS = "__all__"
const LIST = "In the inbox"
const LIST_ID = "inbox-items"
/** Where there is room for the list and the pane side by side. */
const WIDE = "(min-width: 768px)"

const styles = {
  root: css({
    display: "grid",
    gridTemplateColumns: { base: "minmax(0, 1fr)", md: "minmax(320px, 420px) minmax(0, 1fr)" },
    height: "100dvh",
    overflow: "hidden",
  }),
  side: css({
    display: "flex",
    flexDirection: "column",
    minH: "0",
    minW: "0",
    borderRightWidth: { md: "1px" },
    borderColor: "border",
    // On phones the list and the open item take turns.
    "&[data-covered]": { hideBelow: "md" },
  }),
  tabs: css({ px: "3", pt: "3", flexShrink: "0" }),
  count: css({ ml: "1.5", fontWeight: "normal", color: "fg.muted" }),
  toolbar: css({ display: "flex", alignItems: "center", gap: "2", px: "3", py: "2", flexShrink: "0" }),
  filter: css({ width: "48", maxW: "full" }),
  list: css({ position: "relative", flex: "1", minH: "0", overflowY: "auto", outline: "none", pb: "2" }),
  more: css({ display: "flex", justifyContent: "center", py: "3" }),
  loading: css({ display: "flex", justifyContent: "center", py: "10" }),
  pane: css({
    minW: "0",
    minH: "0",
    display: "flex",
    flexDirection: "column",
    "&:not([data-open])": { hideBelow: "md" },
  }),
  nothingOpen: css({ display: "flex", flex: "1", alignItems: "center", justifyContent: "center", px: "6" }),
}

/**
 * The person's inbox: what needs doing, what is only to know, what they put away and what is handled,
 * one list at a time, the item they are on open beside it. Moving through the list by keyboard or
 * mouse opens what is landed on; resolving or snoozing it moves on to the next.
 */
function NotificationsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const view = () => search().view ?? "todo"
  const source = () => search().app
  const setSearch = (change: Partial<typeof InboxSearch.Type>, options?: { readonly replace?: boolean }) =>
    void navigate({ search: (previous) => ({ ...previous, ...change }), replace: options?.replace })

  const inbox = useInfiniteQuery(() => viewQuery(view(), source()))
  const actions = useInboxActions()
  const firstPage = () => inbox.data?.pages[0]
  const items = createMemo(() => inbox.data?.pages.flatMap((page) => page.items) ?? [])
  const sections = createMemo(() => sectionsOf(items(), "day", Date.now()))
  // In the order shown, so that moving down goes to the next row on screen.
  const ordered = createMemo(() => inListOrder(sections()))
  const byId = createMemo(() => new Map(items().map((item) => [item.id, item])))

  // What came while this list was open slides in; each list (and app) starts afresh.
  const arrivalsOf = createMemo(on([view, source], () => createArrivals(Date.now())))
  const arrivals = createMemo(() => arrivalsOf()(items()))

  const list = createListNavigation({
    items: ordered,
    id: (item) => String(item.id),
    label: "Notifications",
    initial: search().item === undefined ? undefined : String(search().item),
    onActiveChange: (id) => setSearch({ item: id === undefined ? undefined : Number(id) }, { replace: true }),
  })

  // The address can change from outside: the bell, the back button.
  createEffect(
    on(
      () => search().item,
      (item) => list.setActive(item === undefined ? undefined : String(item)),
      { defer: true },
    ),
  )
  // Where there is room for both, something is open from the start; on a phone the list comes first.
  createEffect(() => {
    const first = ordered()[0]
    if (list.active() === undefined && first !== undefined && window.matchMedia(WIDE).matches) {
      list.setActive(String(first.id))
    }
  })

  const showView = (next: InboxView) => setSearch({ view: next === "todo" ? undefined : next, item: undefined })
  const counts = () => firstPage()?.counts
  const countOf = (of: InboxView) =>
    of === "todo" ? counts()?.actions : of === "updates" ? counts()?.information : undefined

  const appFilter = () => {
    const sources = firstPage()?.sources ?? []
    const chosen = source()
    // The app chosen stays a choice when nothing of it is left.
    const listed = chosen === undefined || sources.some((count) => count.source === chosen)
    return [
      { value: ALL_APPS, label: "All apps" },
      ...sources.map((count) => ({ value: count.source, label: `${sourceName(count.source)} (${count.count})` })),
      ...(listed || chosen === undefined ? [] : [{ value: chosen, label: sourceName(chosen) }]),
    ]
  }

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
      id: "inbox:select",
      title: "Select",
      group: LIST,
      keys: "x",
      unlisted: true,
      perform: () => {
        const active = list.active()
        if (active !== undefined) list.toggle(active)
      },
    },
    {
      id: "inbox:select-next",
      title: "Select and move down",
      group: LIST,
      keys: "shift+j",
      repeats: true,
      unlisted: true,
      perform: () => list.extend(1),
    },
    {
      id: "inbox:select-previous",
      title: "Select and move up",
      group: LIST,
      keys: "shift+k",
      repeats: true,
      unlisted: true,
      perform: () => list.extend(-1),
    },
    ...(list.selected().size > 0
      ? [{ id: "inbox:clear", title: "Clear selection", group: LIST, keys: "escape", perform: list.clearSelection }]
      : []),
    {
      id: "inbox:open",
      title: "Open in its app",
      group: LIST,
      keys: "enter",
      unlisted: true,
      perform: () => {
        const item = list.activeItem()
        if (item !== undefined) actions.open(item)
      },
    },
    ...(VIEWS[view()].state === "open"
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
      : [{ id: "inbox:reopen", title: "Bring back", group: LIST, keys: "e", perform: onTargets(actions.reopen) }]),
    ...ORDER.filter((other) => other !== view()).map((other) => ({
      id: `inbox:view:${other}`,
      title: `Show ${VIEWS[other].label.toLowerCase()}`,
      group: "Inbox",
      perform: () => showView(other),
    })),
  ])

  const openId = () => search().item

  return (
    <div class={styles.root} style={{ "padding-top": FRAME_TOP }}>
      {/* The page's own actions are in the list's toolbar, beside what they act on, at any width. */}
      <PageTitle title="Notifications" icon={<Bell size={18} />} />

      <section class={styles.side} data-covered={openId() === undefined ? undefined : ""} aria-label="Inbox">
        <Tabs.Root
          class={styles.tabs}
          size="sm"
          variant="subtle"
          value={view()}
          onValueChange={(details) => showView(details.value as InboxView)}
        >
          {/* A choice of the one list below, which is what they control, rather than panels of their own. */}
          <Tabs.List>
            <For each={ORDER}>
              {(each) => (
                <Tabs.Trigger value={each} aria-controls={LIST_ID}>
                  {VIEWS[each].label}
                  <Show when={countOf(each)}>{(count) => <span class={styles.count}>{count()}</span>}</Show>
                </Tabs.Trigger>
              )}
            </For>
          </Tabs.List>
        </Tabs.Root>

        <div class={styles.toolbar}>
          <SelectField
            class={styles.filter}
            size="sm"
            aria-label="App"
            items={appFilter()}
            value={source() ?? ALL_APPS}
            onValueChange={(value) =>
              setSearch({ app: value === null || value === ALL_APPS ? undefined : value, item: undefined })
            }
          />
          <span class={css({ flex: "1" })} />
          <Show when={view() === "updates" && items().length > 0}>
            <Button
              size="xs"
              variant="plain"
              loading={actions.resolvingInformation()}
              onClick={() => actions.resolveInformation(source())}
            >
              Mark all done
            </Button>
          </Show>
          <ActionMenu
            trigger={(trigger) => (
              <IconButton {...trigger()} size="xs" variant="plain" aria-label="More">
                <Ellipsis size={16} />
              </IconButton>
            )}
            items={[
              {
                value: "read",
                label: "Mark all as read",
                icon: <CheckCheck size={16} />,
                disabled: (counts()?.unread ?? 0) === 0,
                onSelect: () => actions.markAllRead.mutate(),
              },
              {
                value: "settings",
                label: "Notification settings",
                icon: <Settings size={16} />,
                onSelect: () => void navigate({ to: "/notifications/settings" }),
              },
            ]}
          />
        </div>

        <div id={LIST_ID} class={styles.list}>
          <Show
            when={inbox.data !== undefined}
            fallback={
              <div class={styles.loading}>
                <Spinner />
              </div>
            }
          >
            <InboxGrid
              sections={sections()}
              navigation={list}
              actions={actions}
              arrivals={arrivals()}
              empty={
                <EmptyState
                  icon={<BellOff size={24} />}
                  title={VIEWS[view()].empty.title}
                  description={
                    source() === undefined
                      ? VIEWS[view()].empty.description
                      : `Nothing here from ${sourceName(source() ?? "")}.`
                  }
                />
              }
            />
            <Show when={inbox.hasNextPage}>
              <div class={styles.more}>
                <Button
                  size="xs"
                  variant="plain"
                  loading={inbox.isFetchingNextPage}
                  onClick={() => void inbox.fetchNextPage()}
                >
                  Load older
                </Button>
              </div>
            </Show>
          </Show>
        </div>

        <BulkBar list={list} actions={actions} />
      </section>

      <section class={styles.pane} data-open={openId() === undefined ? undefined : ""} aria-label="Item">
        <Show
          when={openId()}
          keyed
          fallback={
            <div class={styles.nothingOpen}>
              <Show when={items().length > 0}>
                <EmptyState title="Choose an item" description="What it says and what happened to it show here." />
              </Show>
            </div>
          }
        >
          {(id) => (
            <ReadingPane
              id={id}
              listed={byId().get(id)}
              actions={actions}
              onBack={() => {
                list.setActive(undefined)
                list.focus()
              }}
            />
          )}
        </Show>
      </section>
    </div>
  )
}
