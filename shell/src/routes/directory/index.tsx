import { usePrincipal } from "@mosaik/auth/web"
import type { AnyApp } from "@mosaik/core"
import { EmptyState, Heading, Input, PageHeader, SelectField, SwitchField } from "@mosaik/mosaik-ui"
import { type AccessRequest, canManageApp } from "@mosaik/platform/contract"
import { css } from "@mosaik/styled-system/css"
import { searchValidator } from "@mosaik/web-kit"
import { useQuery } from "@tanstack/solid-query"
import { createFileRoute } from "@tanstack/solid-router"
import { Schema } from "effect"
import LayoutGrid from "lucide-solid/icons/layout-grid"
import Search from "lucide-solid/icons/search"
import { createMemo, createSignal, For, Show } from "solid-js"
import { allApps, categoryOf } from "../../apps"
import { AppCard } from "../../directory/AppCard"
import {
  categoryCounts,
  type DirectoryApp,
  type DirectorySort,
  filterApps,
  groupByCategory,
  sortApps,
} from "../../directory/filter"
import { RequestAccessDialog } from "../../directory/RequestAccessDialog"
import { useMyApps } from "../../workspace/myApps"
import { accessRequestsQuery, popularityQuery } from "../../workspace/queries"

const DirectorySearch = Schema.Struct({
  q: Schema.optional(Schema.String),
  category: Schema.optional(Schema.String),
  sort: Schema.optional(Schema.Literals(["name", "popular"])),
  available: Schema.optional(Schema.Boolean),
})

export const Route = createFileRoute("/_app/directory/")({
  staticData: { title: "All apps", keywords: ["directory", "catalog", "browse", "apps", "request access"] },
  validateSearch: searchValidator(DirectorySearch),
  component: Directory,
})

const SORTS: ReadonlyArray<{ value: DirectorySort; label: string }> = [
  { value: "name", label: "By name" },
  { value: "popular", label: "Most used" },
]

const styles = {
  toolbar: css({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "3" }),
  search: css({ position: "relative", flex: "1", minW: "56", maxW: "md" }),
  searchIcon: css({
    position: "absolute",
    left: "3",
    top: "50%",
    transform: "translateY(-50%)",
    color: "fg.subtle",
    pointerEvents: "none",
  }),
  searchInput: css({ pl: "9" }),
  chips: css({ display: "flex", flexWrap: "wrap", gap: "2" }),
  chip: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "1.5",
    px: "3",
    py: "1",
    borderRadius: "full",
    borderWidth: "1px",
    borderColor: "border",
    fontSize: "sm",
    color: "fg.muted",
    cursor: "pointer",
    _hover: { bg: "gray.subtle.bg", color: "fg.default" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg", outlineOffset: "1px" },
    "&[aria-pressed=true]": {
      bg: "gray.subtle.bg.hover",
      color: "fg.default",
      borderColor: "gray.surface.border.hover",
    },
  }),
  count: css({ fontSize: "xs", color: "fg.subtle" }),
  section: css({ display: "flex", flexDirection: "column", gap: "3" }),
  grid: css({
    display: "grid",
    gap: "4",
    gridTemplateColumns: { base: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" },
  }),
}

/** The latest request per app (the list is newest first). */
const latestRequests = (requests: ReadonlyArray<AccessRequest>): ReadonlyMap<string, AccessRequest> => {
  const latest = new Map<string, AccessRequest>()
  for (const request of requests) if (!latest.has(request.app)) latest.set(request.app, request)
  return latest
}

/**
 * Every app on the platform, by category: the ones the user can open, to pin them, and
 * the others, to ask for access. Each app's page tells more (its roles, its owners).
 */
function Directory() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const principal = usePrincipal()
  const apps = useMyApps()
  const user = () => principal().user?.id

  const popularity = useQuery(() => ({ ...popularityQuery(), enabled: user() !== undefined }))
  const requests = useQuery(() => ({ ...accessRequestsQuery(user() ?? ""), enabled: user() !== undefined }))
  const requestByApp = createMemo(() => latestRequests(requests.data ?? []))
  const activeUsers = createMemo(() => new Map((popularity.data ?? []).map((entry) => [entry.app, entry.activeUsers])))

  const all = createMemo(
    (): ReadonlyArray<DirectoryApp> =>
      allApps.map((app) => ({
        id: app.id,
        name: app.name,
        description: app.description,
        category: categoryOf(app),
        available: principal().can(app.accessPermission),
        activeUsers: activeUsers().get(app.id) ?? 0,
      })),
  )
  const byId = new Map(allApps.map((app) => [app.id, app]))
  const query = () => search().q ?? ""
  const sort = (): DirectorySort => search().sort ?? "name"
  const grouped = () => query().trim() === "" && search().category === undefined

  // Category chips count what the other filters leave.
  const unfiltered = createMemo(() =>
    filterApps(all(), { query: query(), category: undefined, availableOnly: search().available === true }),
  )
  const shown = createMemo(() =>
    sortApps(
      filterApps(all(), {
        query: query(),
        category: search().category,
        availableOnly: search().available === true,
      }),
      sort(),
    ),
  )

  const update = (changes: Partial<typeof DirectorySearch.Type>) =>
    void navigate({ search: (previous) => ({ ...previous, ...changes }), replace: true })

  const [requesting, setRequesting] = createSignal<AnyApp>()

  const card = (entry: DirectoryApp) => {
    const app = byId.get(entry.id)
    if (app === undefined) return null
    return (
      <AppCard
        app={app}
        category={entry.category}
        available={entry.available}
        request={requestByApp().get(app.id)}
        pinned={apps.isPinned(app.id)}
        onTogglePin={apps.canPin() ? () => (apps.isPinned(app.id) ? apps.unpin(app.id) : apps.pin(app.id)) : undefined}
        onRequestAccess={user() === undefined ? undefined : () => setRequesting(app)}
        activeUsers={canManageApp(principal(), app.id) ? entry.activeUsers : undefined}
      />
    )
  }

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "6" })}>
      <PageHeader
        title="All apps"
        description={`${all().length} apps, ${all().filter((app) => app.available).length} of them open to you.`}
        icon={<LayoutGrid size={20} />}
      />

      <div class={styles.toolbar}>
        <div class={styles.search}>
          <span class={styles.searchIcon}>
            <Search size={16} />
          </span>
          <Input
            class={styles.searchInput}
            type="search"
            placeholder="Search apps"
            aria-label="Search apps"
            value={query()}
            onInput={(event) => update({ q: event.currentTarget.value || undefined })}
          />
        </div>
        <SelectField
          aria-label="Sort"
          items={SORTS}
          value={sort()}
          onValueChange={(value) => update({ sort: value === "name" ? undefined : (value ?? undefined) })}
          size="sm"
          class={css({ width: "40" })}
        />
        <SwitchField
          label="Only apps I can open"
          checked={search().available === true}
          onCheckedChange={(checked) => update({ available: checked || undefined })}
        />
      </div>

      {/* biome-ignore lint/a11y/useSemanticElements: a group of toggle buttons, not form fields */}
      <div class={styles.chips} role="group" aria-label="Categories">
        <button
          type="button"
          class={styles.chip}
          aria-pressed={search().category === undefined}
          onClick={() => update({ category: undefined })}
        >
          All <span class={styles.count}>{unfiltered().length}</span>
        </button>
        <For each={categoryCounts(unfiltered())}>
          {(entry) => (
            <button
              type="button"
              class={styles.chip}
              aria-pressed={search().category === entry.category}
              onClick={() => update({ category: search().category === entry.category ? undefined : entry.category })}
            >
              {entry.category} <span class={styles.count}>{entry.count}</span>
            </button>
          )}
        </For>
      </div>

      <Show
        when={shown().length > 0}
        fallback={
          <EmptyState
            icon={<Search size={32} />}
            title="No apps found"
            description="Try another search, or another category."
          />
        }
      >
        <Show when={grouped()} fallback={<div class={styles.grid}>{<For each={shown()}>{card}</For>}</div>}>
          <For each={groupByCategory(shown())}>
            {(group) => (
              <section class={styles.section} aria-label={group.category}>
                <Heading textStyle="md">{group.category}</Heading>
                <div class={styles.grid}>
                  <For each={group.apps}>{card}</For>
                </div>
              </section>
            )}
          </For>
        </Show>
      </Show>

      <Show when={requesting()}>
        {(app) => <RequestAccessDialog app={app()} open onOpenChange={(open) => !open && setRequesting(undefined)} />}
      </Show>
    </div>
  )
}
