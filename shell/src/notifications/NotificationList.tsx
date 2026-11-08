import { toast } from "@mosaik/client"
import type { ListNavigation } from "@mosaik/client/solid"
import { AppIcon, appColor } from "@mosaik/frame"
import { ActionMenu, IconButton, Tooltip } from "@mosaik/mosaik-ui"
import type { InboxItem, Severity } from "@mosaik/notifications/contract"
import { css, cva } from "@mosaik/styled-system/css"
import AlarmClock from "lucide-solid/icons/alarm-clock"
import Bell from "lucide-solid/icons/bell"
import Check from "lucide-solid/icons/check"
import RotateCcw from "lucide-solid/icons/rotate-ccw"
import { For, type JSX, Show } from "solid-js"
import { sourceApp, sourceName } from "../apps"
import type { InboxActions } from "./actions"
import { snoozeChoices, untilLabel } from "./snooze"
import { groupByDay, shortAgo } from "./time"

/** A warning or critical notification's icon takes their colour; Mosaik's own (platform) is quiet. */
const sourceIcon = cva({
  base: { display: "flex", flexShrink: "0", color: "fg.muted" },
  variants: {
    severity: {
      warning: { color: "warning.plain.fg" },
      critical: { color: "danger.plain.fg" },
    },
  },
})

const styles = {
  groups: css({ display: "flex", flexDirection: "column", gap: "2", py: "2" }),
  heading: css({
    px: "4",
    pb: "1",
    fontSize: "xs",
    fontWeight: "semibold",
    color: "fg.muted",
    textTransform: "uppercase",
    letterSpacing: "wider",
  }),
  row: css({
    position: "relative",
    outline: "none",
    _hover: { bg: "gray.subtle.bg" },
    "&[data-active]": { bg: "gray.subtle.bg" },
    _focusVisible: { boxShadow: "inset 2px 0 0 {colors.accent.solid.bg}" },
    // The row's actions show on hover and keyboard focus, over its time and dot.
    "&:is(:hover, :focus-within, [data-active]) > [data-actions]": { opacity: "1", pointerEvents: "auto" },
    // Where they show, the time and the dot make way for them.
    "&:has(> [data-actions]):is(:hover, :focus-within, [data-active]) [data-trailing]": { visibility: "hidden" },
  }),
  item: css({
    display: "flex",
    alignItems: "center",
    gap: "3",
    w: "full",
    px: "4",
    py: "2",
    textAlign: "start",
    cursor: "pointer",
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg", outlineOffset: "-2px" },
  }),
  text: css({ display: "flex", flexDirection: "column", minW: "0", flex: "1" }),
  line: css({ display: "flex", alignItems: "baseline", gap: "2", minW: "0" }),
  title: css({
    flex: "1",
    minW: "0",
    truncate: true,
    fontSize: "sm",
    fontWeight: "medium",
    "&[data-unread=true]": { fontWeight: "semibold" },
  }),
  time: css({ flexShrink: "0", fontSize: "xs", color: "fg.muted", fontVariantNumeric: "tabular-nums" }),
  preview: css({
    fontSize: "xs",
    color: "fg.muted",
    "&[data-lines='1']": { truncate: true },
    "&[data-lines='2']": { lineClamp: "2" },
  }),
  status: css({ fontSize: "xs", color: "fg.muted" }),
  unread: css({ flexShrink: "0", boxSize: "2", borderRadius: "full", bg: "accent.solid.bg" }),
  actions: css({
    position: "absolute",
    top: "50%",
    insetEnd: "3",
    display: "flex",
    gap: "0.5",
    transform: "translateY(-50%)",
    opacity: "0",
    pointerEvents: "none",
    transition: "opacity 0.15s",
  }),
}

/** First paragraph of the body, for previews. */
const preview = (body: string | undefined) => body?.split(/\n\s*\n/)[0]?.trim()

export const severityToast = (severity: Severity | undefined) =>
  severity === "critical" ? toast.error : severity === "success" ? toast.success : toast.info

/** "Resolve" for what asked for action, "Done" for information. */
export const resolveLabel = (item: InboxItem) => (item.action ? "Resolve" : "Done")

/** When the item last changed where it is: its newest notification, its resolution. */
const timeOf = (item: InboxItem) => (item.resolution?.at ?? item.updatedAt).epochMilliseconds

/** Where an item stands, beyond being open: snoozed until when, or resolved by whom. */
const statusOf = (item: InboxItem, now: number): string | undefined => {
  if (item.state === "snoozed" && item.snoozedUntil !== null) {
    return `Until ${untilLabel(new Date(item.snoozedUntil.epochMilliseconds), new Date(now))}`
  }
  const resolution = item.resolution
  if (resolution === null) return undefined
  if (!resolution.app) return item.action ? "Resolved by you" : "Done"
  return resolution.by === null ? `Resolved in ${sourceName(item.source)}` : `Resolved by ${resolution.by.name}`
}

/** What needs the person first, then what is only for them to know. */
const groupByKind = (items: ReadonlyArray<InboxItem>) =>
  [
    { heading: "To do", items: items.filter((item) => item.action) },
    { heading: "For your information", items: items.filter((item) => !item.action) },
  ].filter((group) => group.items.length > 0)

export type Grouping = "kind" | "day"

/** The items in the order the list shows them, which moving through it by keyboard must follow too. */
export const inListOrder = (items: ReadonlyArray<InboxItem>, grouping: Grouping): ReadonlyArray<InboxItem> =>
  grouping === "kind" ? groupByKind(items).flatMap((group) => group.items) : items

/** The sending app's icon, in its colour unless the notification alarms; Mosaik's own get the bell. */
const SourceIcon = (props: { item: InboxItem }) => {
  const severity = () => {
    const severity = props.item.content.severity
    return severity === "warning" || severity === "critical" ? severity : undefined
  }
  const app = () => sourceApp(props.item.source)
  return (
    <span class={sourceIcon({ severity: severity() })} aria-hidden="true">
      <Show when={app()} fallback={<Bell size={18} />}>
        {(found) => (
          <AppIcon
            name={found().portal.icon}
            size={18}
            color={severity() === undefined ? appColor(found()) : undefined}
          />
        )}
      </Show>
    </span>
  )
}

/** What can be done with an item where it is listed: resolve or snooze it, or bring it back. */
const RowActions = (props: { item: InboxItem; actions: InboxActions }) => {
  const title = () => props.item.content.title
  const action = (label: string, icon: JSX.Element, onClick: () => void) => (
    <Tooltip content={label}>
      {(trigger) => (
        <IconButton
          {...trigger()}
          size="xs"
          variant="plain"
          aria-label={`${label}: ${title()}`}
          onClick={(event) => {
            event.stopPropagation()
            onClick()
          }}
        >
          {icon}
        </IconButton>
      )}
    </Tooltip>
  )
  return (
    <div class={styles.actions} data-actions>
      <Show when={props.item.state === "open"}>
        <Show when={props.item.resolvable}>
          {action(resolveLabel(props.item), <Check size={14} />, () => props.actions.resolve([props.item]))}
        </Show>
        <ActionMenu
          trigger={(trigger) => (
            <IconButton
              {...trigger()}
              size="xs"
              variant="plain"
              aria-label={`Snooze: ${title()}`}
              onClick={(event: MouseEvent) => event.stopPropagation()}
            >
              <AlarmClock size={14} />
            </IconButton>
          )}
          items={snoozeChoices(new Date()).map((choice) => ({
            value: choice.id,
            label: choice.label,
            onSelect: () => props.actions.snooze([props.item], choice),
          }))}
        />
      </Show>
      <Show when={props.item.state === "snoozed" || (props.item.resolution !== null && !props.item.resolution.app)}>
        {action(props.item.state === "snoozed" ? "Bring back now" : "Open again", <RotateCcw size={14} />, () =>
          props.actions.reopen([props.item]),
        )}
      </Show>
    </div>
  )
}

/**
 * Inbox items, each with its app's icon, its title and time, a line or two of what it says, and where it
 * stands; open ones in what needs the person and what is only for them to know, the others by day. With
 * `actions`, each can be resolved, snoozed or brought back where it is; with `navigation`, the list is one
 * Tab stop moved through by keyboard.
 */
export const NotificationList = (props: {
  items: ReadonlyArray<InboxItem>
  onOpen: (item: InboxItem) => void
  /** `kind` for open items (to do, then information), `day` for snoozed and resolved ones. */
  grouping: Grouping
  actions?: InboxActions
  navigation?: ListNavigation<InboxItem>
  empty: JSX.Element
  /** How many lines of what it says each shows (1 in the bell's panel). */
  lines?: 1 | 2
}) => {
  const now = Date.now()
  const groups = () =>
    props.grouping === "kind"
      ? groupByKind(props.items)
      : groupByDay(props.items, timeOf, now).map((group) => ({ heading: group.day, items: group.items }))

  const Content = (item: InboxItem) => {
    const what = () => preview(item.content.body)
    const status = () => statusOf(item, now)
    return (
      <>
        <SourceIcon item={item} />
        <span class={styles.text}>
          <span class={styles.line}>
            <span class={styles.title} data-unread={item.readAt === null && item.state === "open"}>
              <Show when={item.readAt === null && item.state === "open"}>
                <span class={css({ srOnly: true })}>Unread: </span>
              </Show>
              {item.content.title}
            </span>
            <time class={styles.time} data-trailing dateTime={new Date(timeOf(item)).toISOString()}>
              {shortAgo(timeOf(item), now)}
            </time>
          </span>
          <span class={styles.preview} data-lines={props.lines ?? 2}>
            {sourceName(item.source)}
            <Show when={item.updates > 1}> · {item.updates} updates</Show>
            <Show when={what()}>{(text) => <> · {text()}</>}</Show>
          </span>
          <Show when={status()}>{(text) => <span class={styles.status}>{text()}</span>}</Show>
        </span>
        <Show when={item.readAt === null && item.state === "open"}>
          <span class={styles.unread} data-trailing aria-hidden="true" />
        </Show>
      </>
    )
  }

  return (
    <Show when={props.items.length > 0} fallback={props.empty}>
      <div class={styles.groups} {...(props.navigation?.listProps ?? {})}>
        <For each={groups()}>
          {(group) => (
            <section aria-label={group.heading}>
              <h3 class={styles.heading}>{group.heading}</h3>
              <ul>
                <For each={group.items}>
                  {(item) => (
                    <Show
                      when={props.navigation}
                      fallback={
                        <li class={styles.row}>
                          <button type="button" class={styles.item} onClick={() => props.onOpen(item)}>
                            {Content(item)}
                          </button>
                          <Show when={props.actions}>
                            {(actions) => <RowActions item={item} actions={actions()} />}
                          </Show>
                        </li>
                      }
                    >
                      {(navigation) => {
                        const row = navigation().rowProps(String(item.id))
                        return (
                          // biome-ignore lint/a11y/useKeyWithClickEvents: by keyboard, Enter opens the active row (the page's commands)
                          <li
                            class={styles.row}
                            {...row}
                            // A click goes into the row as on any list, and on through its link: but not
                            // a click on one of its actions.
                            onClick={(event) => {
                              row.onClick(event)
                              if (!(event.target as Element).closest("button, a, [role=menuitem]")) props.onOpen(item)
                            }}
                          >
                            <div class={styles.item}>{Content(item)}</div>
                            <Show when={props.actions}>
                              {(actions) => <RowActions item={item} actions={actions()} />}
                            </Show>
                          </li>
                        )
                      }}
                    </Show>
                  )}
                </For>
              </ul>
            </section>
          )}
        </For>
      </div>
    </Show>
  )
}
