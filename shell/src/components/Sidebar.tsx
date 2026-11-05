import { assistant } from "@mosaik/assistant/web"
import { usePrincipal } from "@mosaik/auth/web"
import { managesAnyApp } from "@mosaik/console"
import type { AnyApp } from "@mosaik/core"
import { ActionMenu, IconButton, Tooltip } from "@mosaik/mosaik-ui"
import { css, cx } from "@mosaik/styled-system/css"
import { AppIcon, appColorClass, StatusMark, type StatusSummary, useStatusSummary } from "@mosaik/web-kit"
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
import Settings2 from "lucide-solid/icons/settings-2"
import Sparkles from "lucide-solid/icons/sparkles"
import { type Accessor, createContext, For, type JSX, Show, useContext } from "solid-js"
import { appHref } from "../apps"
import { FEW_APPS, type MyAppsState, useMyApps } from "../workspace/myApps"

/**
 * How the sidebar draws its links:
 * - `full`: with their labels, and actions on hover (pinning, ordering);
 * - `rail`: icons only, beside a page that needs the room;
 * - `floating`: the rail opened over the page, with labels but without actions (their menus would
 *   open under it).
 */
export type SidebarMode = "full" | "rail" | "floating"

const ModeContext = createContext<Accessor<SidebarMode>>((): SidebarMode => "full")

const styles = {
  // Sections `gap` apart; the rail's line between them is centred on that space and the heading's.
  nav: css({ display: "flex", flexDirection: "column", gap: "4", flex: "1", overflowY: "auto", px: "3", py: "4" }),
  section: css({ display: "flex", flexDirection: "column", gap: "0.5" }),
  heading: css({
    position: "relative",
    px: "3",
    pb: "1.5",
    fontSize: "xs",
    fontWeight: "semibold",
    color: "fg.subtle",
    textTransform: "uppercase",
    letterSpacing: "wider",
    whiteSpace: "nowrap",
    overflow: "hidden",
    // In the rail, a line in its place, as tall as it, so nothing below moves when the sidebar
    // collapses; the words, unseen, are still read out.
    "&[data-rail=true]": {
      color: "transparent",
      // Midway between the section above and this one: half the nav's gap above the heading's middle.
      _after: {
        content: '""',
        position: "absolute",
        insetX: "2",
        top: "calc(50% - token(spacing.4) / 2)",
        borderTopWidth: "1px",
      },
    },
  }),
  row: css({
    position: "relative",
    // The actions show on hover and keyboard focus, and stay while their menu is open.
    "&:hover > [data-actions], &:focus-within > [data-actions], & > [data-actions]:has([data-state=open])": {
      opacity: "1",
    },
    // Room for them as they show: the link's own mark (a status) moves left of them, not under them.
    "&:has(> [data-actions]):is(:hover, :focus-within, :has(> [data-actions] [data-state=open])) > a": {
      pr: "9",
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
    whiteSpace: "nowrap",
    transition: "background 0.15s, color 0.15s",
    _hover: { bg: "gray.subtle.bg", color: "fg.default" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg", outlineOffset: "-2px" },
    "&[data-status=active]": { bg: "gray.subtle.bg.hover", color: "fg.default" },
  }),
  // An app's icon is grey like the rest of the list, in the app's colour while it is the open one.
  appIcon: css({ "[data-status=active] &": { color: "colorPalette.plain.fg" } }),
  // As tall as a line of the label beside it, so a row is as tall with its label (expanded) as without (rail).
  icon: css({ position: "relative", display: "flex", alignItems: "center", flexShrink: "0", height: "1lh" }),
  label: css({ flex: "1", minW: "0", truncate: true }),
  actions: css({
    position: "absolute",
    top: "50%",
    right: "1",
    transform: "translateY(-50%)",
    opacity: "0",
    transition: "opacity 0.15s",
  }),
  hint: css({ px: "3", fontSize: "xs", color: "fg.subtle", lineHeight: "relaxed" }),
  hintLink: css({ color: "accent.plain.fg", _hover: { textDecoration: "underline" } }),
}

const NavLink = (props: {
  /** On the icon: what colours it. */
  iconClass?: string
  to: string
  exact?: boolean
  icon: JSX.Element
  label: string
  /** What its statuses come to: the mark beside it. */
  status?: StatusSummary
  onNavigate?: () => void
  actions?: JSX.Element
}) => {
  const mode = useContext(ModeContext)
  return (
    <div>
      <div class={styles.row}>
        {/* In the rail, the label shows beside the icon on hover and focus. */}
        <Tooltip content={props.label} disabled={mode() !== "rail"} positioning={{ placement: "right" }}>
          <Link
            to={props.to}
            class={styles.link}
            activeOptions={{ exact: props.exact ?? false }}
            onClick={() => props.onNavigate?.()}
          >
            <span class={cx(styles.icon, props.iconClass)}>
              {props.icon}
              <Show when={mode() === "rail" && props.status}>
                {(status) => <StatusMark summary={status()} corner />}
              </Show>
            </span>
            <span class={mode() === "rail" ? css({ srOnly: true }) : styles.label}>{props.label}</span>
            <Show when={mode() !== "rail" && props.status}>{(status) => <StatusMark summary={status()} />}</Show>
          </Link>
        </Tooltip>
        <Show when={mode() === "full" && props.actions}>
          <div class={styles.actions} data-actions>
            {props.actions}
          </div>
        </Show>
      </div>
    </div>
  )
}

/** A link of Mosaik's own, with the statuses at its path (e.g. requests for access waiting). */
const PlaceLink = (props: {
  to: string
  exact?: boolean
  icon: JSX.Element
  label: string
  onNavigate?: () => void
}) => {
  const status = useStatusSummary(
    () => props.to,
    () => false,
  )
  return <NavLink {...props} status={status()} />
}

const Section = (props: { heading: string; children: JSX.Element }) => {
  const mode = useContext(ModeContext)
  return (
    <div class={styles.section}>
      <div class={styles.heading} data-rail={mode() === "rail"}>
        {props.heading}
      </div>
      {props.children}
    </div>
  )
}

/** An app in the sidebar, with what its statuses and its pages' come to. */
const AppEntry = (props: { app: AnyApp; actions?: JSX.Element; onNavigate?: () => void }) => {
  const home = () => appHref(props.app)
  const status = useStatusSummary(home, () => true)
  return (
    <NavLink
      to={home()}
      icon={<AppIcon name={props.app.portal.icon} />}
      iconClass={cx(appColorClass(props.app), styles.appIcon)}
      label={props.app.name}
      status={status()}
      onNavigate={props.onNavigate}
      actions={props.actions}
    />
  )
}

const PinnedActions = (props: { apps: MyAppsState; app: AnyApp; index: number; count: number }) => (
  <ActionMenu
    trigger={(triggerProps) => (
      <IconButton aria-label={`Options for ${props.app.name}`} size="2xs" variant="plain" {...triggerProps()}>
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
 * Navigation: the overview and the assistant; the principal's apps, the ones they pinned, then
 * either every other app (when they can open only a few) or the ones they used recently (an app's
 * pages are in the top bar, `AppLayout`); and for owners and admins, what they manage. "All apps"
 * lists the rest.
 */
export const Sidebar = (props: { mode?: SidebarMode; onNavigate?: () => void }) => {
  const apps = useMyApps()
  const principal = usePrincipal()
  // For owners and admins: the requests they can answer.
  const reviewing = () => managesAnyApp(principal())
  // The assistant, once an admin set up a model (the same query as the shell's button).
  const assistantStatus = useQuery(() => ({
    ...assistant.assistant.status.query(),
    enabled: principal().isAuthenticated,
  }))
  const few = () => apps.accessible().length <= FEW_APPS
  const others = () => (few() ? apps.accessible().filter((app) => !apps.isPinned(app.id)) : apps.recent())
  const appLink = (app: AnyApp, actions?: JSX.Element) => (
    <AppEntry app={app} actions={actions} onNavigate={props.onNavigate} />
  )

  return (
    <ModeContext.Provider value={() => props.mode ?? "full"}>
      <nav class={styles.nav} aria-label="Main">
        <div class={styles.section}>
          <NavLink to="/" exact icon={<LayoutDashboard size={18} />} label="Overview" onNavigate={props.onNavigate} />
          <NavLink to="/directory" icon={<LayoutGrid size={18} />} label="All apps" onNavigate={props.onNavigate} />
          <Show when={principal().isAuthenticated && assistantStatus.data?.enabled === true}>
            <PlaceLink to="/assistant" icon={<Sparkles size={18} />} label="Assistant" onNavigate={props.onNavigate} />
          </Show>
        </div>
        <Show when={apps.pinned().length > 0}>
          <Section heading="Pinned">
            <For each={apps.pinned()}>
              {(app, index) =>
                appLink(app, <PinnedActions apps={apps} app={app} index={index()} count={apps.pinned().length} />)
              }
            </For>
          </Section>
        </Show>
        <Show
          when={others().length > 0}
          fallback={
            <Show when={!few() && apps.pinned().length === 0 && props.mode !== "rail"}>
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
          <Section heading={few() ? "Apps" : "Recent"}>
            <For each={others()}>
              {(app) =>
                appLink(
                  app,
                  <Show when={apps.canPin()}>
                    <IconButton
                      aria-label={`Pin ${app.name}`}
                      size="xs"
                      variant="plain"
                      onClick={() => apps.pin(app.id)}
                    >
                      <Pin size={14} />
                    </IconButton>
                  </Show>,
                )
              }
            </For>
          </Section>
        </Show>
        <Show when={reviewing()}>
          <Section heading="Manage">
            <PlaceLink
              to="/access-requests"
              icon={<Inbox size={18} />}
              label="Access requests"
              onNavigate={props.onNavigate}
            />
            <NavLink to="/manage" icon={<Settings2 size={18} />} label="Manage apps" onNavigate={props.onNavigate} />
          </Section>
        </Show>
      </nav>
    </ModeContext.Provider>
  )
}
