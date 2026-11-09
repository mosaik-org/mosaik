import { useSearchParams } from "@mosaik/sdk/router"
import { createDebounced, createListNavigation, useNow } from "@mosaik/sdk/solid"
import { createListCollection, EmptyState, Input, InputGroup, Select, Spinner, Tabs } from "@mosaik/ui"
import { css } from "@mosaik/web-sdk/css"
import { FRAME_TOP, useCommands } from "@mosaik/web-sdk/portal"
import { useQuery, useQueryClient } from "@tanstack/solid-query"
import { DateTime } from "effect"
import Search from "lucide-solid/icons/search"
import { createEffect, createMemo, createSignal, For, type JSX, on, Show, Suspense } from "solid-js"
import {
  type DeadlineState,
  deadlineOf,
  QueueId,
  REQUESTS_PAGE,
  RequestId,
  type RequestRow,
  RequestsSearch,
  type RequestsState,
  type RequestsView,
} from "../../api"
import { useDesk } from "../context"
import { activityQuery, requestsQuery } from "../queries"
import { RequestPane, type RequestPaneHandle } from "../request/RequestPane"
import { BulkBar } from "./BulkBar"
import { createRequestPickers } from "./pickers"
import { RequestListRow } from "./RequestListRow"
import { requestCommands } from "./requestCommands"

const styles = {
  root: css({
    display: "grid",
    gridTemplateColumns: { base: "minmax(0, 1fr)", md: "minmax(320px, 400px) minmax(0, 1fr)" },
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
    // On phones the list and the open request take turns.
    "&[data-covered]": { hideBelow: "md" },
  }),
  toolbar: css({ display: "flex", alignItems: "center", gap: "2", px: "3", pt: "3", pb: "2" }),
  search: css({ flex: "1", minW: "0" }),
  state: css({ width: "28", flexShrink: "0" }),
  tabs: css({ px: "3", flexShrink: "0" }),
  list: css({ position: "relative", flex: "1", minH: "0", overflowY: "auto", outline: "none" }),
  section: css({
    position: "sticky",
    top: "0",
    zIndex: "1",
    px: "3",
    py: "1",
    fontSize: "xs",
    fontWeight: "medium",
    color: "fg.muted",
    bg: "bg",
  }),
  count: css({ ml: "1.5", fontWeight: "normal" }),
  more: css({
    display: "block",
    width: "full",
    py: "3",
    fontSize: "sm",
    color: "fg.muted",
    cursor: "pointer",
    _hover: { color: "fg" },
  }),
  loading: css({ display: "flex", justifyContent: "center", py: "10", color: "fg.muted" }),
  pane: css({
    minW: "0",
    minH: "0",
    display: "flex",
    flexDirection: "column",
    "&:not([data-open])": { hideBelow: "md" },
  }),
  nothingOpen: css({ display: "flex", flex: "1", alignItems: "center", justifyContent: "center", px: "6" }),
}

const SECTION_RANK: Readonly<Record<DeadlineState | "none", number>> = { missed: 0, soon: 1, ok: 2, none: 3 }
const SECTION_TITLES: Readonly<Record<DeadlineState | "none", string>> = {
  missed: "Overdue",
  soon: "Due soon",
  ok: "On track",
  none: "Waiting for a reply",
}

export interface WorkspaceProps {
  readonly view: RequestsView
  readonly label: string
  /** Shown by how pressing they are, most pressing first, rather than by when something last happened. */
  readonly grouped?: boolean
  /** Offers what is done as well as what is being worked on. */
  readonly withState?: boolean
  /** For the person who asked: where their requests stand, rather than what is due. */
  readonly forRequester?: boolean
  /** What the list shows when nothing is in it: an `EmptyState`. */
  readonly empty: JSX.Element
}

const LIST_ID = "desk-requests"

const STATES = createListCollection({
  items: [
    { value: "active", label: "Active" },
    { value: "done", label: "Done" },
  ],
})

/**
 * A list of requests and the open one beside it. Moving through the list opens what the person lands on:
 * one place to be, rather than a row selected and another open.
 */
export const Workspace = (props: WorkspaceProps) => {
  const desk = useDesk()
  const client = useQueryClient()
  const now = useNow()
  const [search, setSearch] = useSearchParams(RequestsSearch)
  const [limit, setLimit] = createSignal(REQUESTS_PAGE)
  // Someone who only sends requests sees all of theirs together; they have no state to choose by default.
  const state = (): RequestsState | undefined =>
    search().state ?? (props.withState && !props.forRequester ? "active" : undefined)

  const page = useQuery(() =>
    requestsQuery({
      view: props.view,
      queue: search().queue,
      state: state(),
      search: search().search,
      limit: limit(),
    }),
  )

  const showsSections = () => props.grouped === true && state() !== "done"
  const sectionOf = (row: RequestRow, at: DateTime.Utc): DeadlineState | "none" => deadlineOf(row, at)?.state ?? "none"

  /** In the order they show. Sorted here too: what is short of time depends on how long it had, and time passes. */
  const rows = createMemo((): ReadonlyArray<RequestRow> => {
    const found = page.data?.rows ?? []
    if (!showsSections()) return found
    const at = DateTime.makeUnsafe(now())
    return found.toSorted((a, b) => SECTION_RANK[sectionOf(a, at)] - SECTION_RANK[sectionOf(b, at)])
  })
  const rowById = createMemo(() => new Map(rows().map((row) => [String(row.id), row])))

  const list = createListNavigation<RequestRow>({
    items: rows,
    id: (row) => String(row.id),
    label: props.label,
    initial: search().open === undefined ? undefined : String(search().open),
    onActiveChange: (id) =>
      setSearch((previous) => ({ ...previous, open: id === undefined ? undefined : RequestId.make(Number(id)) }), {
        replace: true,
      }),
  })

  // The address can change from outside: a notification's link, the back button.
  createEffect(
    on(
      () => search().open,
      (open) => list.setActive(open === undefined ? undefined : String(open)),
      { defer: true },
    ),
  )

  // Where there is room for both, something is open from the start; on a phone the list comes first.
  createEffect(() => {
    const first = rows()[0]
    if (list.active() === undefined && first !== undefined && window.matchMedia("(min-width: 768px)").matches) {
      list.setActive(String(first.id))
    }
  })

  // What is one key away loads before the key is pressed, so moving feels immediate.
  createEffect(
    on(list.active, (active) => {
      const all = rows()
      const at = all.findIndex((row) => String(row.id) === active)
      for (const neighbour of [all[at + 1], all[at - 1]]) {
        if (neighbour !== undefined) void client.prefetchQuery({ ...activityQuery(neighbour.id), staleTime: 30_000 })
      }
    }),
  )

  /** Section headings and row ids, flat: keyed by id, rows keep their elements (and focus) as data refreshes. */
  const entries = createMemo((): ReadonlyArray<string> => {
    if (!showsSections()) return rows().map((row) => String(row.id))
    const at = DateTime.makeUnsafe(now())
    const flat: Array<string> = []
    let previous: string | undefined
    for (const row of rows()) {
      const section = sectionOf(row, at)
      if (section !== previous) flat.push(`section:${section}`)
      previous = section
      flat.push(String(row.id))
    }
    return flat
  })
  const sectionCounts = createMemo(() => {
    const at = DateTime.makeUnsafe(now())
    const counts = new Map<string, number>()
    for (const row of rows()) {
      const section = sectionOf(row, at)
      counts.set(section, (counts.get(section) ?? 0) + 1)
    }
    return counts
  })

  // Typing updates the address once the person pauses.
  const [text, setText] = createSignal(search().search ?? "")
  const debounced = createDebounced(text, 250)
  createEffect(
    on(
      debounced,
      (value) => setSearch((previous) => ({ ...previous, search: value.trim() || undefined }), { replace: true }),
      { defer: true },
    ),
  )
  let searchInput: HTMLInputElement | undefined

  let pane: RequestPaneHandle | undefined
  const pickers = createRequestPickers(desk, () => list.clearSelection())

  useCommands(() =>
    requestCommands({
      list,
      pickers,
      pane: () => pane,
      forRequester: props.forRequester === true,
      focusSearch: () => searchInput?.focus(),
    }),
  )

  const queueTabs = () => {
    if (props.forRequester) return []
    const counts = new Map((page.data?.byQueue ?? []).map((count) => [count.queueId, count.count]))
    return desk.queues().map((queue) => ({ id: String(queue.id), name: queue.name, count: counts.get(queue.id) ?? 0 }))
  }
  const totalInQueues = () => (page.data?.byQueue ?? []).reduce((sum, count) => sum + count.count, 0)
  const openId = () => {
    const open = search().open
    return open === undefined ? undefined : open
  }

  return (
    <div class={styles.root} style={{ "padding-top": FRAME_TOP }}>
      <section class={styles.side} data-covered={openId() === undefined ? undefined : ""} aria-label={props.label}>
        <div class={styles.toolbar}>
          <div class={styles.search}>
            <InputGroup startElement={<Search />}>
              <Input
                ref={searchInput}
                type="search"
                placeholder="Search"
                aria-label={`Search ${props.label.toLowerCase()}`}
                value={text()}
                onInput={(event) => setText(event.currentTarget.value)}
                onKeyDown={(event) => {
                  // Back to the list, which is where the search's results are.
                  if (event.key === "Escape" || event.key === "Enter") {
                    event.preventDefault()
                    list.focus()
                  }
                }}
              />
            </InputGroup>
          </div>
          <Show when={props.withState}>
            <Select.Root
              class={styles.state}
              collection={STATES}
              value={[state() ?? "active"]}
              onValueChange={(details) =>
                setSearch((previous) => ({ ...previous, state: details.value[0] as RequestsState, open: undefined }))
              }
            >
              <Select.Control>
                <Select.Trigger aria-label="Show">
                  <Select.ValueText />
                  <Select.Indicator />
                </Select.Trigger>
              </Select.Control>
              <Select.Positioner>
                <Select.Content>
                  <For each={STATES.items}>
                    {(item) => (
                      <Select.Item item={item}>
                        <Select.ItemText>{item.label}</Select.ItemText>
                        <Select.ItemIndicator />
                      </Select.Item>
                    )}
                  </For>
                </Select.Content>
              </Select.Positioner>
            </Select.Root>
          </Show>
        </div>

        <Show when={queueTabs().length > 0}>
          <Tabs.Root
            class={styles.tabs}
            size="sm"
            variant="subtle"
            value={search().queue === undefined ? "__all__" : String(search().queue)}
            onValueChange={(details) =>
              setSearch((previous) => ({
                ...previous,
                queue: details.value === "__all__" ? undefined : QueueId.make(Number(details.value)),
                open: undefined,
              }))
            }
          >
            {/* A filter over the one list below: that is what they control, rather than panels of their own. */}
            <Tabs.List>
              <Tabs.Trigger value="__all__" aria-controls={LIST_ID}>
                All <span class={styles.count}>{totalInQueues()}</span>
              </Tabs.Trigger>
              <For each={queueTabs()}>
                {(queue) => (
                  <Tabs.Trigger value={queue.id} aria-controls={LIST_ID}>
                    {queue.name} <span class={styles.count}>{queue.count}</span>
                  </Tabs.Trigger>
                )}
              </For>
            </Tabs.List>
          </Tabs.Root>
        </Show>

        <div
          id={LIST_ID}
          class={styles.list}
          data-selecting={list.selected().size > 0 ? "" : undefined}
          {...list.listProps}
        >
          <Show
            when={page.data !== undefined}
            fallback={
              <div class={styles.loading}>
                <Spinner />
              </div>
            }
          >
            <Show when={rows().length > 0} fallback={props.empty}>
              <For each={entries()}>
                {(entry) =>
                  entry.startsWith("section:") ? (
                    <div class={styles.section} role="presentation">
                      {SECTION_TITLES[entry.slice("section:".length) as DeadlineState | "none"]}
                      <span class={styles.count}>{sectionCounts().get(entry.slice("section:".length))}</span>
                    </div>
                  ) : (
                    <RequestListRow
                      id={entry}
                      row={rowById().get(entry)}
                      list={list}
                      forRequester={props.forRequester === true}
                    />
                  )
                }
              </For>
              <Show when={(page.data?.total ?? 0) > rows().length}>
                <button
                  type="button"
                  class={styles.more}
                  onClick={() => setLimit((current) => current + REQUESTS_PAGE)}
                >
                  Show more ({(page.data?.total ?? 0) - rows().length} left)
                </button>
              </Show>
            </Show>
          </Show>
        </div>

        <BulkBar list={list} pickers={pickers} />
      </section>

      <section class={styles.pane} data-open={openId() === undefined ? undefined : ""} aria-label="Request">
        {/*
          Its own boundary: a request still loading would otherwise suspend the page around it, taking
          the list, and focus in the list, with it.
        */}
        <Suspense
          fallback={
            <div class={styles.loading}>
              <Spinner />
            </div>
          }
        >
          <Show
            when={openId()}
            keyed
            fallback={
              <div class={styles.nothingOpen}>
                <Show when={rows().length > 0}>
                  <EmptyState.Root>
                    <EmptyState.Content>
                      <EmptyState.Title>Choose a request</EmptyState.Title>
                      <EmptyState.Description>Its story and what to do next show here.</EmptyState.Description>
                    </EmptyState.Content>
                  </EmptyState.Root>
                </Show>
              </div>
            }
          >
            {(id) => (
              <RequestPane
                id={id}
                listed={rowById().get(String(id))}
                forRequester={props.forRequester === true}
                onBack={() => {
                  list.setActive(undefined)
                }}
                onLeave={() => list.focus()}
                ref={(handle) => {
                  pane = handle
                }}
              />
            )}
          </Show>
        </Suspense>
      </section>
    </div>
  )
}
