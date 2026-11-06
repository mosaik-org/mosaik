import { formatRelativeTime } from "@mosaik/sdk/client"
import { css } from "@mosaik/sdk/css"
import { useQuery } from "@tanstack/solid-query"
import Lock from "lucide-solid/icons/lock"
import { createEffect, For, Match, on, Show, Suspense, Switch } from "solid-js"
import type { Activity, RequestRow } from "../../api"
import { PersonAvatar } from "../components/PersonAvatar"
import { activityQuery } from "../queries"

const styles = {
  root: css({
    flex: "1",
    minH: "0",
    overflowY: "auto",
    px: { base: "4", lg: "6" },
    py: "4",
    display: "flex",
    flexDirection: "column",
    gap: "4",
  }),
  post: css({ display: "flex", gap: "3", minW: "0" }),
  content: css({ flex: "1", minW: "0", display: "flex", flexDirection: "column", gap: "1" }),
  who: css({ display: "flex", alignItems: "baseline", gap: "2", fontSize: "sm" }),
  name: css({ fontWeight: "medium", color: "fg.default" }),
  when: css({ fontSize: "xs", color: "fg.muted" }),
  text: css({ fontSize: "sm", color: "fg.default", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }),
  // Told apart by a mark and a surface, never by alarm: an internal note is ordinary.
  note: css({ bg: "gray.subtle.bg", borderRadius: "l2", p: "3" }),
  noteLabel: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "1",
    fontSize: "xs",
    color: "fg.muted",
    "& svg": { boxSize: "3" },
  }),
  change: css({ fontSize: "xs", color: "fg.muted", pl: "9" }),
}

const changeWords = (line: Activity): string => {
  const { from, to } = line
  switch (line.field) {
    case "assignee":
      return to === null ? (from === null ? "was unassigned" : `took it from ${from}`) : `assigned it to ${to}`
    case "status":
      return `moved it to ${to}`
    case "priority":
      return `set priority to ${to}`
    case "queue":
      return `moved it to ${to}`
    case "title":
      return `renamed it to "${to}"`
    case "body":
      return "edited the details"
    default:
      return "changed it"
  }
}

const Post = (props: { line: Activity }) => (
  <div class={styles.post}>
    <Show when={props.line.author}>{(author) => <PersonAvatar person={author()} size="xs" />}</Show>
    <div class={styles.content} classList={{ [styles.note]: props.line.kind === "note" }}>
      <div class={styles.who}>
        <span class={styles.name}>{props.line.author?.name ?? "Service Desk"}</span>
        <span class={styles.when}>{formatRelativeTime(props.line.createdAt)}</span>
        <Show when={props.line.kind === "note"}>
          <span class={styles.noteLabel}>
            <Lock />
            Internal note
          </span>
        </Show>
      </div>
      <div class={styles.text}>{props.line.body}</div>
    </div>
  </div>
)

/** The request's story, oldest first, ending just above where to write. */
export const Timeline = (props: { row: RequestRow; forRequester: boolean }) => {
  const activity = useQuery(() => activityQuery(props.row.id))
  let root: HTMLDivElement | undefined

  // To what was said last, when opening a request and when something new comes.
  createEffect(
    on(
      () => activity.data?.length,
      () => {
        if (root !== undefined) root.scrollTop = root.scrollHeight
      },
    ),
  )

  return (
    <div ref={root} class={styles.root}>
      <div class={styles.post}>
        <PersonAvatar person={props.row.requester} size="xs" />
        <div class={styles.content}>
          <div class={styles.who}>
            <span class={styles.name}>{props.row.requester.name}</span>
            <span class={styles.when}>{formatRelativeTime(props.row.createdAt)}</span>
          </div>
          <div class={styles.text}>{props.row.body}</div>
        </div>
      </div>
      {/* What it says shows at once; its story follows when it has loaded. */}
      <Suspense>
        <For each={activity.data ?? []}>
          {(line) => (
            <Switch>
              <Match when={line.kind === "reply" || line.kind === "note"}>
                <Post line={line} />
              </Match>
              <Match when={line.kind === "change"}>
                <div class={styles.change}>
                  {`${line.author?.name ?? "The desk"} ${changeWords(line)} · ${formatRelativeTime(line.createdAt)}`}
                </div>
              </Match>
            </Switch>
          )}
        </For>
      </Suspense>
    </div>
  )
}
