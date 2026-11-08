import { Button, IconButton, Spinner } from "@mosaik/mosaik-ui"
import type { InboxItem, InboxUpdate } from "@mosaik/notifications/contract"
import { css } from "@mosaik/styled-system/css"
import { useQuery } from "@tanstack/solid-query"
import AlarmClock from "lucide-solid/icons/alarm-clock"
import ArrowLeft from "lucide-solid/icons/arrow-left"
import ArrowUpRight from "lucide-solid/icons/arrow-up-right"
import BellRing from "lucide-solid/icons/bell-ring"
import Check from "lucide-solid/icons/check"
import RotateCcw from "lucide-solid/icons/rotate-ccw"
import { createEffect, For, Show } from "solid-js"
import { sourceName } from "../apps"
import type { InboxActions } from "./actions"
import { itemQuery } from "./api"
import { SourceIcon } from "./InboxRow"
import { isUnread, paragraphs, resolveLabel, statusOf } from "./model"
import { SnoozeMenu } from "./SnoozeMenu"
import { TypeSettingsMenu } from "./TypeSettingsMenu"
import { shortAgo } from "./time"

const styles = {
  pane: css({ display: "flex", flexDirection: "column", minH: "0", flex: "1" }),
  toolbar: css({
    display: "flex",
    alignItems: "center",
    gap: "1",
    px: { base: "3", md: "6" },
    py: "2",
    borderBottomWidth: "1px",
    borderColor: "border",
    flexShrink: "0",
  }),
  back: css({ hideFrom: "md", mr: "auto" }),
  spacer: css({ flex: "1", hideBelow: "md" }),
  scroll: css({ flex: "1", minH: "0", overflowY: "auto" }),
  article: css({
    display: "flex",
    flexDirection: "column",
    gap: "5",
    maxW: "2xl",
    px: { base: "4", md: "6" },
    py: "6",
  }),
  meta: css({ display: "flex", alignItems: "center", gap: "2", fontSize: "sm", color: "fg.muted" }),
  title: css({ textStyle: "xl", fontWeight: "semibold", letterSpacing: "-0.01em", color: "fg.default" }),
  status: css({
    fontSize: "sm",
    color: "fg.muted",
    borderLeftWidth: "2px",
    borderColor: "border",
    pl: "3",
  }),
  body: css({
    display: "flex",
    flexDirection: "column",
    gap: "3",
    fontSize: "sm",
    lineHeight: "1.6",
    whiteSpace: "pre-line",
  }),
  fields: css({
    display: "grid",
    gridTemplateColumns: "max-content minmax(0, 1fr)",
    columnGap: "6",
    rowGap: "2",
    fontSize: "sm",
    "& dt": { color: "fg.muted" },
  }),
  open: css({ alignSelf: "flex-start" }),
  history: css({
    display: "flex",
    flexDirection: "column",
    gap: "3",
    pt: "5",
    borderTopWidth: "1px",
    borderColor: "border",
  }),
  historyTitle: css({
    fontSize: "xs",
    fontWeight: "semibold",
    color: "fg.muted",
    textTransform: "uppercase",
    letterSpacing: "wider",
  }),
  entries: css({ display: "flex", flexDirection: "column", gap: "3" }),
  entry: css({
    display: "grid",
    gridTemplateColumns: "3rem minmax(0, 1fr)",
    gap: "3",
    fontSize: "sm",
    "& time": { color: "fg.muted", fontSize: "xs", fontVariantNumeric: "tabular-nums", pt: "0.5" },
  }),
  entryBody: css({ color: "fg.muted", fontSize: "xs", lineClamp: "2" }),
  loading: css({ display: "grid", placeItems: "center", flex: "1", py: "10" }),
}

const fullDate = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })

/** What happened to the item's subject, the newest first: each notification it holds. */
const History = (props: { updates: ReadonlyArray<InboxUpdate>; now: number }) => (
  <section class={styles.history} aria-label="History">
    <h3 class={styles.historyTitle}>History</h3>
    <ol class={styles.entries}>
      <For each={props.updates}>
        {(update) => (
          <li class={styles.entry}>
            <time
              dateTime={new Date(update.at.epochMilliseconds).toISOString()}
              title={fullDate(update.at.epochMilliseconds)}
            >
              {shortAgo(update.at.epochMilliseconds, props.now)}
            </time>
            <div>
              <div>{update.content.title}</div>
              <Show when={paragraphs(update.content.body)[0]}>
                {(first) => <div class={styles.entryBody}>{first()}</div>}
              </Show>
            </div>
          </li>
        )}
      </For>
    </ol>
  </section>
)

/** Why an open item stays until its app resolves it, and what the person can do meanwhile. */
const guardedNote = (appName: string) => `Only ${appName} can resolve this, once it is handled. You can snooze it.`

/**
 * One inbox item in full: what it says and its facts, what can be done with it (open it in its app,
 * resolve it, snooze it, choose how such notifications reach the person), and the notifications that
 * came before about the same subject. Showing it is reading it.
 */
export const ReadingPane = (props: {
  id: number
  /** The item as the list has it, shown while its history loads. */
  listed: InboxItem | undefined
  actions: InboxActions
  /** Back to the list, where the list and the pane take turns (phones). */
  onBack: () => void
}) => {
  const detail = useQuery(() => itemQuery(props.id))
  const item = () => detail.data?.item ?? props.listed
  const now = Date.now()

  // Read once shown, and again if a later notification about it comes while it is open.
  let readAt: number | undefined
  createEffect(() => {
    const shown = item()
    if (shown === undefined || !isUnread(shown) || readAt === shown.updatedAt.epochMilliseconds) return
    readAt = shown.updatedAt.epochMilliseconds
    props.actions.markRead([shown])
  })

  return (
    <div class={styles.pane}>
      <Show
        when={item()}
        fallback={
          <div class={styles.loading}>
            <Show when={detail.isError} fallback={<Spinner />}>
              <span class={css({ color: "fg.muted", fontSize: "sm" })}>This item is no longer in your inbox.</span>
            </Show>
          </div>
        }
      >
        {(shown) => {
          const appName = () => sourceName(shown().source)
          const status = () =>
            statusOf(shown(), appName(), now) ??
            (shown().state === "open" && !shown().resolvable ? guardedNote(appName()) : undefined)
          const link = () => shown().content.link
          const external = () => link()?.startsWith("http") === true
          return (
            <>
              <div class={styles.toolbar} role="toolbar" aria-label="Item">
                <Button class={styles.back} variant="plain" size="xs" onClick={() => props.onBack()}>
                  <ArrowLeft size={16} />
                  Inbox
                </Button>
                <span class={styles.spacer} />
                <Show when={shown().state === "open" && shown().resolvable}>
                  <Button size="xs" variant="outline" onClick={() => props.actions.resolve([shown()])}>
                    <Check size={14} />
                    {resolveLabel(shown())}
                  </Button>
                </Show>
                <Show when={shown().state === "open"}>
                  <SnoozeMenu
                    trigger={(trigger) => (
                      <Button {...trigger()} size="xs" variant="outline">
                        <AlarmClock size={14} />
                        Snooze
                      </Button>
                    )}
                    onSnooze={(time) => props.actions.snooze([shown()], time)}
                  />
                </Show>
                <Show when={shown().state === "snoozed" || (shown().resolution !== null && !shown().resolution?.app)}>
                  <Button size="xs" variant="outline" onClick={() => props.actions.reopen([shown()])}>
                    <RotateCcw size={14} />
                    {shown().state === "snoozed" ? "Bring back now" : "Open again"}
                  </Button>
                </Show>
                <TypeSettingsMenu
                  type={shown().type}
                  trigger={(trigger) => (
                    <IconButton {...trigger()} size="xs" variant="plain" aria-label="Notifications like this">
                      <BellRing size={16} />
                    </IconButton>
                  )}
                />
              </div>

              <div class={styles.scroll}>
                <article class={styles.article}>
                  <div class={styles.meta}>
                    <SourceIcon item={shown()} size={16} />
                    <span>{appName()}</span>
                    <span aria-hidden="true">·</span>
                    <time
                      dateTime={new Date(shown().updatedAt.epochMilliseconds).toISOString()}
                      title={fullDate(shown().updatedAt.epochMilliseconds)}
                    >
                      {shortAgo(shown().updatedAt.epochMilliseconds, now)}
                    </time>
                  </div>
                  <h2 class={styles.title}>{shown().content.title}</h2>
                  <Show when={status()}>{(text) => <p class={styles.status}>{text()}</p>}</Show>
                  <Show when={paragraphs(shown().content.body).length > 0}>
                    <div class={styles.body}>
                      <For each={paragraphs(shown().content.body)}>{(paragraph) => <p>{paragraph}</p>}</For>
                    </div>
                  </Show>
                  <Show when={(shown().content.fields ?? []).length > 0}>
                    <dl class={styles.fields}>
                      <For each={shown().content.fields}>
                        {(field) => (
                          <>
                            <dt>{field.label}</dt>
                            <dd>{field.value}</dd>
                          </>
                        )}
                      </For>
                    </dl>
                  </Show>
                  <Show when={link()}>
                    <Button class={styles.open} onClick={() => props.actions.open(shown())}>
                      {shown().content.linkLabel ?? (external() ? "Open" : `Open in ${appName()}`)}
                      <ArrowUpRight size={16} />
                    </Button>
                  </Show>
                  <Show when={(detail.data?.history.length ?? 0) > 1}>
                    <History updates={detail.data?.history ?? []} now={now} />
                  </Show>
                </article>
              </div>
            </>
          )
        }}
      </Show>
    </div>
  )
}
