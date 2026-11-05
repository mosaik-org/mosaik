import { Badge, Card, Input, SelectField, Stat } from "@mosaik/mosaik-ui"
import { barChartOption, Chart } from "@mosaik/sdk/charts"
import { formatRelativeTime } from "@mosaik/sdk/client"
import { css } from "@mosaik/sdk/css"
import { useSearchParams } from "@mosaik/sdk/portal"
import { createDebounced } from "@mosaik/sdk/solid"
import { createColumnHelper, DataTable } from "@mosaik/sdk/table"
import { QueryBoundary, QueryFreshness } from "@mosaik/sdk/ui"
import { useQuery } from "@tanstack/solid-query"
import ExternalLink from "lucide-solid/icons/external-link"
import { createEffect, createMemo, createSignal, on, Show } from "solid-js"
import { IssuesSearch, type JiraIssue, StatusCategory } from "../../api"
import { issuesQuery, projectsQuery } from "../queries"

const CATEGORY = {
  todo: { label: "To do", tone: "neutral" },
  "in-progress": { label: "In progress", tone: "accent" },
  done: { label: "Done", tone: "success" },
} as const satisfies Record<StatusCategory, { label: string; tone: string }>

const CATEGORY_FILTERS = [
  { value: "open", label: "Open issues" },
  ...StatusCategory.literals.map((category) => ({ value: category, label: CATEGORY[category].label })),
]

const column = createColumnHelper<JiraIssue>()

const columns = column.columns([
  column.accessor("key", {
    header: "Key",
    cell: (info) => (
      <a
        href={info.row.original.url}
        target="_blank"
        rel="noopener noreferrer"
        class={css({
          display: "inline-flex",
          alignItems: "center",
          gap: "1",
          fontFamily: "mono",
          color: "accent.plain.fg",
        })}
      >
        {info.getValue()}
        <ExternalLink size={12} />
      </a>
    ),
  }),
  column.accessor("summary", { header: "Summary" }),
  column.accessor("status", {
    header: "Status",
    cell: (info) => (
      <Badge variant="dot" colorPalette={CATEGORY[info.row.original.statusCategory].tone}>
        {info.getValue()}
      </Badge>
    ),
  }),
  column.accessor("type", { header: "Type" }),
  column.accessor("priority", { header: "Priority", cell: (info) => info.getValue() ?? "—" }),
  column.accessor("assignee", { header: "Assignee", cell: (info) => info.getValue() ?? "Unassigned" }),
  column.accessor((issue) => issue.updated.epochMilliseconds, {
    id: "updated",
    header: "Updated",
    cell: (info) => formatRelativeTime(info.getValue()),
  }),
])

/** Counts per key, largest first. */
const countBy = <T,>(items: ReadonlyArray<T>, key: (item: T) => string) =>
  [
    ...items.reduce(
      (counts, item) => counts.set(key(item), (counts.get(key(item)) ?? 0) + 1),
      new Map<string, number>(),
    ),
  ]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

const styles = {
  toolbar: css({ display: "flex", gap: "3", flexWrap: "wrap", alignItems: "center" }),
  stats: css({
    display: "grid",
    gap: "4",
    gridTemplateColumns: { base: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" },
  }),
  charts: css({ display: "grid", gap: "4", gridTemplateColumns: { base: "1fr", lg: "1fr 1fr" } }),
  note: css({ fontSize: "xs", color: "fg.muted" }),
}

/** Open Jira issues, filtered by project, status and text (all kept in the URL). */
export default function IssuesPage() {
  const [search, setSearch] = useSearchParams(IssuesSearch)
  const list = useQuery(() => issuesQuery(search()))
  const projects = useQuery(projectsQuery)

  const update = (changes: Partial<IssuesSearch>, replace = false) =>
    setSearch((previous) => ({ ...previous, ...changes }), { replace })

  const [text, setText] = createSignal(search().q ?? "")
  const debouncedText = createDebounced(text, 300)
  createEffect(on(debouncedText, (value) => update({ q: value.trim() || undefined }, true), { defer: true }))
  createEffect(
    on(
      () => search().q,
      (value) => {
        if ((value ?? "") !== debouncedText().trim()) setText(value ?? "")
      },
      { defer: true },
    ),
  )

  const issues = createMemo(() => list.data?.data.issues ?? [])
  const byProject = createMemo(() => countBy(issues(), (issue) => issue.project.key))
  const byAssignee = createMemo(() => countBy(issues(), (issue) => issue.assignee ?? "Unassigned").slice(0, 8))
  const byCategory = (category: StatusCategory) => issues().filter((issue) => issue.statusCategory === category).length
  const projectItems = () => [
    { value: "all", label: "All projects" },
    ...(projects.data?.data ?? []).map((project) => ({
      value: project.key,
      label: `${project.name} (${project.key})`,
    })),
  ]

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
      <div class={styles.toolbar}>
        <Input
          type="search"
          placeholder="Search text or issue key…"
          value={text()}
          onInput={(event) => setText(event.currentTarget.value)}
          class={css({ maxWidth: "xs" })}
        />
        <SelectField
          aria-label="Project"
          items={projectItems()}
          value={search().project ?? "all"}
          onValueChange={(value) => update({ project: value === "all" ? undefined : (value ?? undefined) })}
          class={css({ width: "56" })}
        />
        <SelectField
          aria-label="Status"
          items={CATEGORY_FILTERS}
          value={search().category ?? "open"}
          onValueChange={(value) => update({ category: value === "open" ? undefined : (value as StatusCategory) })}
          class={css({ width: "40" })}
        />
        <div class={css({ flex: "1" })} />
        <QueryFreshness query={list} staleAfter="10 minutes" />
      </div>

      <QueryBoundary query={list}>
        {(data) => (
          <>
            <div class={styles.stats}>
              <Stat
                label="Issues"
                value={String(issues().length)}
                hint={data().data.truncated ? "First 200 shown" : undefined}
              />
              <Stat label="To do" value={String(byCategory("todo"))} />
              <Stat label="In progress" value={String(byCategory("in-progress"))} />
              <Stat label="Unassigned" value={String(issues().filter((issue) => issue.assignee === null).length)} />
            </div>

            <div class={styles.charts}>
              <Card.Root>
                <Card.Header>
                  <Card.Title>By project</Card.Title>
                </Card.Header>
                <Card.Body gap="4">
                  <Chart
                    height="240px"
                    option={barChartOption({
                      categories: byProject().map((entry) => entry.name),
                      series: [{ name: "Issues", data: byProject().map((entry) => entry.count) }],
                    })}
                  />
                </Card.Body>
              </Card.Root>
              <Card.Root>
                <Card.Header>
                  <Card.Title>By assignee</Card.Title>
                </Card.Header>
                <Card.Body gap="4">
                  <Chart
                    height="240px"
                    option={barChartOption({
                      horizontal: true,
                      categories: byAssignee().map((entry) => entry.name),
                      series: [{ name: "Issues", data: byAssignee().map((entry) => entry.count) }],
                    })}
                  />
                </Card.Body>
              </Card.Root>
            </div>

            <DataTable
              columns={columns}
              data={issues()}
              getRowId={(issue) => issue.key}
              loading={list.isFetching}
              emptyMessage="No issues match the filters."
            />
            <Show when={data().data.truncated}>
              <p class={styles.note}>
                Only the 200 most recently updated issues are shown. Narrow the filters to see others.
              </p>
            </Show>
          </>
        )}
      </QueryBoundary>
    </div>
  )
}
