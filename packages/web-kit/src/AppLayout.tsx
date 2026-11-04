import { useCan } from "@mosaik/auth/web"
import type { AnyApp } from "@mosaik/core"
import { ActionMenu, PageHeader } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/solid-router"
import Check from "lucide-solid/icons/check"
import ChevronDown from "lucide-solid/icons/chevron-down"
import { createMemo, type JSX, Show } from "solid-js"
import { AppIcon } from "./AppIcon"
import { AppTabs } from "./AppTabs"
import { appPageLinks, currentPage } from "./appPages"
import { FrameHeader, useHasFrameHeader } from "./FrameHeader"
import { NavTabs } from "./NavTabs"

const styles = {
  // In the frame's header: the app, as the page's heading.
  title: css({
    display: "flex",
    alignItems: "center",
    minW: "0",
    flexShrink: "0",
    fontSize: "sm",
    fontWeight: "medium",
  }),
  app: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "2",
    minW: "0",
    color: "fg.default",
    cursor: "pointer",
    _hover: { color: "accent.plain.fg" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg", borderRadius: "l1" },
  }),
  page: css({ color: "fg.muted", truncate: true }),
  // From tablets up, where the app's pages are tabs beside it; on phones, a menu of them.
  wide: css({ display: "flex", minW: "0", hideBelow: "md" }),
  narrow: css({ display: "flex", minW: "0", hideFrom: "md" }),
  actions: css({ display: "flex", alignItems: "center", gap: "2", ml: "auto", flexShrink: "0" }),
}

export interface AppLayoutProps {
  readonly app: AnyApp
  readonly actions?: JSX.Element
  /** A lucide icon name; defaults to the one the app gives the Portal (`portal.icon`). */
  readonly icon?: string
}

/**
 * Standard frame for an app: its name and icon from the manifest, its pages (`portal.pages`) as
 * tabs and its actions, in the frame's header (`FrameHeader`), the app's name a menu of its pages
 * on phones; above the page where the frame has none (Core's console). Then the page shown.
 */
export const AppLayout = (props: AppLayoutProps) => {
  const can = useCan()
  const location = useLocation()
  const navigate = useNavigate()
  const inFrameHeader = useHasFrameHeader()
  const links = createMemo(() => appPageLinks(props.app, can))
  const current = () => currentPage(links(), location().pathname)
  const icon = () => props.icon ?? props.app.portal.icon
  // The app's first page; a plain path, as links to a frame's routes are (apps' are not in its tree).
  const home = (): string => `/${props.app.id}`

  // Built where it shows (an element is in one place only).
  const name = () => (
    <>
      <AppIcon name={icon()} size={18} />
      {props.app.name}
    </>
  )

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "6" })}>
      <Show
        when={inFrameHeader}
        fallback={
          <>
            <PageHeader
              icon={<AppIcon name={icon()} size={22} />}
              title={props.app.name}
              description={props.app.description}
              actions={props.actions}
            />
            <Show when={links().length > 0}>
              <NavTabs items={links()} />
            </Show>
          </>
        }
      >
        <FrameHeader>
          <h1 class={styles.title}>
            <Show
              when={links().length > 0}
              fallback={
                <Link to={home()} class={styles.app}>
                  {name()}
                </Link>
              }
            >
              <span class={styles.wide}>
                <Link to={home()} class={styles.app}>
                  {name()}
                </Link>
              </span>
              {/* On phones, no room for tabs: the app's name opens its pages. Hidden around the menu, as
                  its trigger brings classes of its own. */}
              <span class={styles.narrow}>
                <ActionMenu
                  trigger={(trigger) => (
                    <button type="button" {...trigger()}>
                      <span class={styles.app}>
                        {name()}
                        <Show when={current()}>{(page) => <span class={styles.page}>/ {page().label}</span>}</Show>
                        <ChevronDown size={14} />
                      </span>
                    </button>
                  )}
                  items={links().map((link) => ({
                    value: link.to,
                    label: link.label,
                    ...(link.to === current()?.to ? { icon: <Check size={14} /> } : {}),
                    onSelect: () => void navigate({ href: link.to }),
                  }))}
                />
              </span>
            </Show>
          </h1>
          <Show when={links().length > 0}>
            <AppTabs label={`${props.app.name} pages`} links={links()} current={current()?.to} home={home()} />
          </Show>
          <Show when={props.actions}>
            <div class={styles.actions}>{props.actions}</div>
          </Show>
        </FrameHeader>
      </Show>
      <Outlet />
    </div>
  )
}
