import { formatRelativeTime } from "@mosaik/sdk/client"
import { useSearchParams } from "@mosaik/sdk/router"
import { createDebounced } from "@mosaik/sdk/solid"
import { Badge, Card, createListCollection, Input, Select, Stat } from "@mosaik/ui"
import { barChartOption, Chart } from "@mosaik/web-sdk/charts"
import { css } from "@mosaik/web-sdk/css"
import { createColumnHelper, DataTable } from "@mosaik/web-sdk/table"
import { QueryBoundary, QueryFreshness } from "@mosaik/web-sdk/ui"
import { useQuery } from "@tanstack/solid-query"
import Circle from "lucide-solid/icons/circle"
import CircleCheck from "lucide-solid/icons/circle-check"
import CircleDot from "lucide-solid/icons/circle-dot"
import ExternalLink from "lucide-solid/icons/external-link"
import { createEffect, createMemo, createSignal, For, Index, on, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { IssuesSearch, type JiraIssue, StatusCategory } from "../../api"
import { issuesQuery, projectsQuery } from "../queries"

/** Each category's label, and its shape beside a status: grey, as none of them asks for attention. */
const CATEGORY = {
  todo: { label: "To do", icon: Circle },
  "in-progress": { label: "In progress", icon: CircleDot },
  done: { label: "Done", icon: CircleCheck },
} as const satisfies Record<StatusCategory, { label: string; icon: typeof Circle }>

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
          color: "accent.fg",
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
      <Badge size="sm">
        <Dynamic component={CATEGORY[info.row.original.statusCategory].icon} aria-hidden="true" />
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
  hidden: css({ srOnly: true }),
}

/**
 * A select of the toolbar. Its label is for assistive technology only: the chosen option ("All
 * projects") already shows what it filters.
 */
const Filter = (props: {
  label: string
  options: ReadonlyArray<{ value: string; label: string }>
  value: string
  onValueChange: (value: string) => void
  class?: string
}) => {
  const collection = createMemo(() => createListCollection({ items: [...props.options] }))
  return (
    <Select.Root
      class={props.class}
      collection={collection()}
      value={[props.value]}
      onValueChange={(details) => {
        const [value] = details.value
        if (value !== undefined) props.onValueChange(value)
      }}
    >
      <Select.Label class={styles.hidden}>{props.label}</Select.Label>
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText />
          <Select.Indicator />
        </Select.Trigger>
      </Select.Control>
      <Select.Positioner>
        <Select.Content>
          <For each={collection().items}>
            {(option) => (
              <Select.Item item={option}>
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator />
              </Select.Item>
            )}
          </For>
        </Select.Content>
      </Select.Positioner>
    </Select.Root>
  )
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
        <Filter
          label="Project"
          options={projectItems()}
          value={search().project ?? "all"}
          onValueChange={(value) => update({ project: value === "all" ? undefined : value })}
          class={css({ width: "56" })}
        />
        <Filter
          label="Status"
          options={CATEGORY_FILTERS}
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
              <Index
                each={[
                  {
                    label: "Issues",
                    value: issues().length,
                    help: data().data.truncated ? "First 200 shown" : undefined,
                  },
                  { label: "To do", value: byCategory("todo") },
                  { label: "In progress", value: byCategory("in-progress") },
                  { label: "Unassigned", value: issues().filter((issue) => issue.assignee === null).length },
                ]}
              >
                {(stat) => (
                  <Card.Root>
                    <Card.Body>
                      <Stat.Root>
                        <Stat.Label>{stat().label}</Stat.Label>
                        <Stat.Value>{stat().value}</Stat.Value>
                        <Show when={stat().help}>{(help) => <Stat.Help>{help()}</Stat.Help>}</Show>
                      </Stat.Root>
                    </Card.Body>
                  </Card.Root>
                )}
              </Index>
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
