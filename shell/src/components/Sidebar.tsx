import { usePrincipal } from "@mosaik/auth/web"
import type { AnyApp } from "@mosaik/core"
import { css } from "@mosaik/styled-system/css"
import { AppIcon, IconButton, Menu } from "@mosaik/ui"
import { useQuery } from "@tanstack/solid-query"
import { Link } from "@tanstack/solid-router"
import ArrowDown from "lucide-solid/icons/arrow-down"
import ArrowUp from "lucide-solid/icons/arrow-up"
import Ellipsis from "lucide-solid/icons/ellipsis"
import Inbox from "lucide-solid/icons/inbox"
import LayoutDashboard from "lucide-solid/icons/layout-dashboard"
import LayoutGrid from "lucide-solid/icons/layout-grid"
import Pin from "lucide-solid/icons/pin"
import PinOff from "lucide-solid/icons/pin-off"
import { For, type JSX, Show } from "solid-js"
import { managesAnyApp, reviewsQuery } from "../access/queries"
import { appHref } from "../apps"
import { FEW_APPS, type MyAppsState, useMyApps } from "../workspace/myApps"

const styles = {
  nav: css({ display: "flex", flexDirection: "column", gap: "6", flex: "1", overflowY: "auto", px: "3", py: "4" }),
  section: css({ display: "flex", flexDirection: "column", gap: "0.5" }),
  heading: css({
    px: "3",
    pb: "1.5",
    fontSize: "xs",
    fontWeight: "semibold",
    color: "fg.subtle",
    textTransform: "uppercase",
    letterSpacing: "wider",
  }),
  row: css({
    position: "relative",
    // The actions show on hover and keyboard focus, and stay while their menu is open.
    "&:hover > [data-actions], &:focus-within > [data-actions], & > [data-actions]:has([data-state=open])": {
      opacity: "1",
    },
  }),
  link: css({
    display: "flex",
    alignItems: "center",
    gap: "2.5",
    px: "3",
    py: "2",
    borderRadius: "md",
    fontSize: "sm",
    fontWeight: "medium",
    color: "fg.muted",
    transition: "background 0.15s, color 0.15s",
    _hover: { bg: "bg.muted", color: "fg.default" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.default", outlineOffset: "-2px" },
    "&[data-status=active]": { bg: "accent.subtle", color: "accent.text" },
  }),
  label: css({ flex: "1", minW: "0", truncate: true }),
  count: css({
    minW: "5",
    px: "1.5",
    borderRadius: "full",
    bg: "accent.default",
    color: "accent.fg",
    fontSize: "xs",
    fontWeight: "semibold",
    textAlign: "center",
  }),
  actions: css({
    position: "absolute",
    top: "50%",
    right: "1",
    transform: "translateY(-50%)",
    opacity: "0",
    transition: "opacity 0.15s",
  }),
  hint: css({ px: "3", fontSize: "xs", color: "fg.subtle", lineHeight: "relaxed" }),
  hintLink: css({ color: "accent.text", _hover: { textDecoration: "underline" } }),
}

const NavLink = (props: {
  to: string
  exact?: boolean
  icon: JSX.Element
  label: string
  /** Things waiting there, e.g. requests to answer. */
  count?: number
  onNavigate?: () => void
  actions?: JSX.Element
}) => (
  <div class={styles.row}>
    <Link
      to={props.to}
      class={styles.link}
      activeOptions={{ exact: props.exact ?? false }}
      onClick={() => props.onNavigate?.()}
    >
      {props.icon}
      <span class={styles.label}>{props.label}</span>
      <Show when={(props.count ?? 0) > 0}>
        <span class={styles.count}>
          {props.count}
          <span class={css({ srOnly: true })}> waiting</span>
        </span>
      </Show>
    </Link>
    <Show when={props.actions}>
      <div class={styles.actions} data-actions>
        {props.actions}
      </div>
    </Show>
  </div>
)

const PinnedActions = (props: { apps: MyAppsState; app: AnyApp; index: number; count: number }) => (
  <Menu
    trigger={(triggerProps) => (
      <IconButton label={`Options for ${props.app.name}`} size="sm" variant="ghost" {...triggerProps}>
        <Ellipsis size={14} />
      </IconButton>
    )}
    items={[
      {
        value: "up",
        label: "Move up",
        icon: <ArrowUp size={14} />,
        disabled: props.index === 0,
        onSelect: () => props.apps.move(props.app.id, -1),
      },
      {
        value: "down",
        label: "Move down",
        icon: <ArrowDown size={14} />,
        disabled: props.index === props.count - 1,
        onSelect: () => props.apps.move(props.app.id, 1),
      },
      {
        value: "unpin",
        label: "Unpin",
        icon: <PinOff size={14} />,
        onSelect: () => props.apps.unpin(props.app.id),
      },
    ]}
  />
)

/**
 * Navigation to the principal's apps: the ones they pinned, then either every other app
 * (when they can open only a few) or the ones they used recently. "All apps" lists the rest.
 */
export const Sidebar = (props: { onNavigate?: () => void }) => {
  const apps = useMyApps()
  const principal = usePrincipal()
  // For owners and admins: the requests they can answer.
  const reviewing = () => managesAnyApp(principal())
  const waiting = useQuery(() => ({
    ...reviewsQuery(principal().user?.id ?? "", { status: "pending" }),
    enabled: reviewing(),
  }))
  const few = () => apps.accessible().length <= FEW_APPS
  const others = () => (few() ? apps.accessible().filter((app) => !apps.isPinned(app.id)) : apps.recent())

  const appLink = (app: AnyApp, actions?: JSX.Element) => (
    <NavLink
      to={appHref(app)}
      icon={<AppIcon name={app.portal.icon} />}
      label={app.name}
      onNavigate={props.onNavigate}
      actions={actions}
    />
  )

  return (
    <nav class={styles.nav} aria-label="Main">
      <div class={styles.section}>
        <NavLink to="/" exact icon={<LayoutDashboard size={18} />} label="Overview" onNavigate={props.onNavigate} />
        <NavLink to="/directory" icon={<LayoutGrid size={18} />} label="All apps" onNavigate={props.onNavigate} />
        <Show when={reviewing()}>
          <NavLink
            to="/access-requests"
            icon={<Inbox size={18} />}
            label="Access requests"
            count={waiting.data?.length ?? 0}
            onNavigate={props.onNavigate}
          />
        </Show>
      </div>
      <Show when={apps.pinned().length > 0}>
        <div class={styles.section}>
          <div class={styles.heading}>Pinned</div>
          <For each={apps.pinned()}>
            {(app, index) =>
              appLink(app, <PinnedActions apps={apps} app={app} index={index()} count={apps.pinned().length} />)
            }
          </For>
        </div>
      </Show>
      <Show
        when={others().length > 0}
        fallback={
          <Show when={!few() && apps.pinned().length === 0}>
            <p class={styles.hint}>
              Apps you open or pin show up here. Find them in{" "}
              <Link to="/directory" class={styles.hintLink} onClick={() => props.onNavigate?.()}>
                All apps
              </Link>
              .
            </p>
          </Show>
        }
      >
        <div class={styles.section}>
          <div class={styles.heading}>{few() ? "Apps" : "Recent"}</div>
          <For each={others()}>
            {(app) =>
              appLink(
                app,
                <Show when={apps.canPin()}>
                  <IconButton label={`Pin ${app.name}`} size="sm" variant="ghost" onClick={() => apps.pin(app.id)}>
                    <Pin size={14} />
                  </IconButton>
                </Show>,
              )
            }
          </For>
        </div>
      </Show>
    </nav>
  )
}
