import { signInUrl } from "@mosaik/auth/contract"
import type { AnyApp } from "@mosaik/core"
import type { AccessRequest } from "@mosaik/platform/contract"
import { css } from "@mosaik/styled-system/css"
import { AppIcon, Badge, Button, Card, IconButton } from "@mosaik/ui"
import { Link } from "@tanstack/solid-router"
import ArrowRight from "lucide-solid/icons/arrow-right"
import Lock from "lucide-solid/icons/lock"
import Pin from "lucide-solid/icons/pin"
import { type JSX, Match, Show, Switch } from "solid-js"
import { appHref } from "../apps"

const styles = {
  card: css({ display: "flex", flexDirection: "column", gap: "3", height: "full" }),
  header: css({ display: "flex", alignItems: "flex-start", gap: "3" }),
  icon: css({
    display: "grid",
    placeItems: "center",
    flexShrink: "0",
    width: "10",
    height: "10",
    borderRadius: "lg",
    bg: "accent.subtle",
    color: "accent.text",
    "&[data-available=false]": { bg: "bg.muted", color: "fg.subtle" },
  }),
  titles: css({ display: "flex", flexDirection: "column", gap: "0.5", flex: "1", minW: "0" }),
  name: css({
    fontWeight: "semibold",
    truncate: true,
    _hover: { textDecoration: "underline" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.default", outlineOffset: "1px" },
  }),
  category: css({ fontSize: "xs", color: "fg.subtle" }),
  description: css({ color: "fg.muted", fontSize: "sm", flex: "1", lineClamp: "3" }),
  footer: css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2", minH: "8" }),
  open: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "1",
    fontSize: "sm",
    fontWeight: "medium",
    color: "accent.text",
    _hover: { textDecoration: "underline" },
  }),
  note: css({ fontSize: "xs", color: "fg.subtle" }),
  pinned: css({ color: "accent.text", fill: "currentColor" }),
}

export interface AppCardProps {
  app: AnyApp
  category: string
  available: boolean
  /** The user's latest request for access, if any. */
  request: AccessRequest | undefined
  pinned: boolean
  /** `undefined` when the user cannot pin (not logged in). */
  onTogglePin: (() => void) | undefined
  /** `undefined` when the user cannot ask (not logged in). */
  onRequestAccess: (() => void) | undefined
  /** For the people who manage the app: people who used it lately. */
  activeUsers: number | undefined
}

/** An app in the directory: what it is, and what the user can do about it. */
export const AppCard = (props: AppCardProps) => {
  const pinButton = (): JSX.Element => (
    <Show when={props.available && props.onTogglePin}>
      {(toggle) => (
        <IconButton
          label={props.pinned ? `Unpin ${props.app.name}` : `Pin ${props.app.name}`}
          size="sm"
          variant="ghost"
          aria-pressed={props.pinned}
          onClick={() => toggle()()}
        >
          <Pin size={16} class={props.pinned ? styles.pinned : undefined} />
        </IconButton>
      )}
    </Show>
  )

  return (
    <Card class={styles.card}>
      <div class={styles.header}>
        <div class={styles.icon} data-available={props.available}>
          <AppIcon name={props.app.portal.icon} size={20} />
        </div>
        <div class={styles.titles}>
          <Link to="/directory/$app" params={{ app: props.app.id }} class={styles.name}>
            {props.app.name}
          </Link>
          <span class={styles.category}>{props.category}</span>
        </div>
        {pinButton()}
      </div>
      <div class={styles.description}>{props.app.description}</div>
      <div class={styles.footer}>
        <Switch>
          <Match when={props.available}>
            <Link to={appHref(props.app)} class={styles.open}>
              Open <ArrowRight size={14} />
            </Link>
          </Match>
          <Match when={props.request?.status === "pending"}>
            <Badge tone="accent">Access requested</Badge>
          </Match>
          <Match when={props.onRequestAccess}>
            {(request) => (
              <Button size="sm" variant="outline" onClick={() => request()()}>
                <Lock size={14} /> {props.request?.status === "declined" ? "Ask again" : "Request access"}
              </Button>
            )}
          </Match>
          <Match when={true}>
            <a href={signInUrl("/directory")} class={styles.open}>
              Log in to open
            </a>
          </Match>
        </Switch>
        <Show when={props.activeUsers !== undefined}>
          <span class={styles.note}>
            {props.activeUsers} {props.activeUsers === 1 ? "person" : "people"} this month
          </span>
        </Show>
      </div>
    </Card>
  )
}
