import { AppIcon, appColor } from "@mosaik/frame"
import type { InboxItem } from "@mosaik/notifications/contract"
import { css, cva } from "@mosaik/styled-system/css"
import { IconButton, Tooltip } from "@mosaik/ui"
import AlarmClock from "lucide-solid/icons/alarm-clock"
import Bell from "lucide-solid/icons/bell"
import Check from "lucide-solid/icons/check"
import RotateCcw from "lucide-solid/icons/rotate-ccw"
import { type JSX, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { sourceApp, sourceName } from "../apps"
import type { InboxActions } from "./actions"
import { isUnread, paragraphs, resolveLabel, statusOf, timeOf } from "./model"
import { SnoozeMenu } from "./SnoozeMenu"
import { shortAgo } from "./time"

/** A warning or critical notification's icon takes their colour; the rest keep their app's. */
const sourceIcon = cva({
  base: { display: "flex", flexShrink: "0", color: "fg.muted" },
  variants: {
    severity: {
      warning: { color: "warning.fg" },
      critical: { color: "danger.fg" },
    },
  },
})

const styles = {
  content: css({ display: "flex", alignItems: "center", gap: "3", flex: "1", minW: "0" }),
  text: css({ display: "flex", flexDirection: "column", minW: "0", flex: "1" }),
  line: css({ display: "flex", alignItems: "baseline", gap: "2", minW: "0" }),
  title: css({
    flex: "1",
    minW: "0",
    truncate: true,
    fontSize: "sm",
    fontWeight: "medium",
    "&[data-unread]": { fontWeight: "semibold" },
  }),
  time: css({ flexShrink: "0", fontSize: "xs", color: "fg.muted", fontVariantNumeric: "tabular-nums" }),
  preview: css({
    fontSize: "xs",
    color: "fg.muted",
    "&[data-lines='1']": { truncate: true },
    "&[data-lines='2']": { lineClamp: "2" },
  }),
  status: css({ fontSize: "xs", color: "fg.muted" }),
  unread: css({ flexShrink: "0", boxSize: "2", borderRadius: "full", bg: "accent.solid" }),
  // Over the row's time and dot, shown where the row is hovered, focused or active (`[data-actions]`).
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

/**
 * Styles for a row that holds `RowContent` and `RowActions`: its actions show on hover and keyboard
 * focus, and the time and the dot make way for them.
 */
export const rowActionsReveal = {
  "&:is(:hover, :focus-within, [data-active]) [data-actions]": { opacity: "1", pointerEvents: "auto" },
  "&:has([data-actions]):is(:hover, :focus-within, [data-active]) [data-trailing]": { visibility: "hidden" },
} as const

/** The sending app's icon, in its colour unless the notification alarms; Mosaik's own get the bell. */
export const SourceIcon = (props: { item: InboxItem; size?: number }) => {
  const severity = () => {
    const severity = props.item.content.severity
    return severity === "warning" || severity === "critical" ? severity : undefined
  }
  const app = () => sourceApp(props.item.source)
  return (
    <span class={sourceIcon({ severity: severity() })} aria-hidden="true">
      <Show when={app()} fallback={<Bell size={props.size ?? 18} />}>
        {(found) => (
          <AppIcon
            name={found().portal.icon}
            size={props.size ?? 18}
            color={severity() === undefined ? appColor(found()) : undefined}
          />
        )}
      </Show>
    </span>
  )
}

/**
 * What a row says of an item: its app's icon, its title and when it changed, a line or two of what it
 * says (after its app), and where it stands; a dot while it is unread.
 */
export const RowContent = (props: { item: InboxItem; now: number; lines?: 1 | 2 }) => {
  const appName = () => sourceName(props.item.source)
  const first = () => paragraphs(props.item.content.body)[0]
  const status = () => statusOf(props.item, appName(), props.now)
  return (
    <span class={styles.content}>
      <SourceIcon item={props.item} />
      <span class={styles.text}>
        <span class={styles.line}>
          <span class={styles.title} data-unread={isUnread(props.item) ? "" : undefined}>
            <Show when={isUnread(props.item)}>
              <span class={css({ srOnly: true })}>Unread: </span>
            </Show>
            {props.item.content.title}
          </span>
          <time class={styles.time} data-trailing dateTime={new Date(timeOf(props.item)).toISOString()}>
            {shortAgo(timeOf(props.item), props.now)}
          </time>
        </span>
        <span class={styles.preview} data-lines={props.lines ?? 2}>
          {appName()}
          <Show when={props.item.updates > 1}> · {props.item.updates} updates</Show>
          <Show when={first()}>{(text) => <> · {text()}</>}</Show>
        </span>
        <Show when={status()}>{(text) => <span class={styles.status}>{text()}</span>}</Show>
      </span>
      <Show when={isUnread(props.item)}>
        <span class={styles.unread} data-trailing aria-hidden="true" />
      </Show>
    </span>
  )
}

/** What can be done with an item where it is listed: resolve or snooze it, or bring it back. */
export const RowActions = (props: { item: InboxItem; actions: InboxActions }) => {
  const title = () => props.item.content.title
  const action = (label: string, icon: JSX.Element, onClick: () => void) => (
    <Tooltip.Root>
      <Tooltip.Trigger
        onClick={(event) => {
          event.stopPropagation()
          onClick()
        }}
        asChild={(trigger) => (
          <IconButton {...trigger()} size="xs" variant="ghost" aria-label={`${label}: ${title()}`}>
            {icon}
          </IconButton>
        )}
      />
      <Portal>
        <Tooltip.Positioner>
          <Tooltip.Content>{label}</Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  )
  return (
    <div class={styles.actions} data-actions>
      <Show when={props.item.state === "open"}>
        <Show when={props.item.resolvable}>
          {action(resolveLabel(props.item), <Check size={14} />, () => props.actions.resolve([props.item]))}
        </Show>
        <SnoozeMenu
          trigger={(trigger) => (
            <IconButton
              {...trigger()}
              size="xs"
              variant="ghost"
              aria-label={`Snooze: ${title()}`}
              onClick={(event: MouseEvent) => event.stopPropagation()}
            >
              <AlarmClock size={14} />
            </IconButton>
          )}
          onSnooze={(time) => props.actions.snooze([props.item], time)}
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
