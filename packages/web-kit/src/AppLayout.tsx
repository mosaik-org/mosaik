import { useCan } from "@mosaik/auth/web"
import type { AnyApp } from "@mosaik/core"
import { PageHeader } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { Outlet } from "@tanstack/solid-router"
import { createContext, type JSX, Show, useContext } from "solid-js"
import { AppIcon } from "./AppIcon"
import { appPageLinks } from "./appPages"
import { NavTabs } from "./NavTabs"

const FrameListsPagesContext = createContext(false)

/**
 * Tells `AppLayout` that the frame around apps lists their pages itself (the shell does, in its
 * sidebar), so it does not show them again as tabs. Without it (Core's console), it does.
 */
export const FrameListsPages = (props: { readonly children: JSX.Element }): JSX.Element => (
  <FrameListsPagesContext.Provider value={true}>{props.children}</FrameListsPagesContext.Provider>
)

export interface AppLayoutProps {
  readonly app: AnyApp
  readonly actions?: JSX.Element
  /** A lucide icon name; defaults to the one the app gives the Portal (`portal.icon`). */
  readonly icon?: string
}

/**
 * Standard frame for an app: its header from the manifest, its pages (`portal.pages`, as tabs
 * where the frame does not list them) and the page shown.
 */
export const AppLayout = (props: AppLayoutProps) => {
  const can = useCan()
  const listedByFrame = useContext(FrameListsPagesContext)
  const tabs = () => (listedByFrame ? [] : appPageLinks(props.app, can))

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "6" })}>
      <PageHeader
        icon={<AppIcon name={props.icon ?? props.app.portal.icon} size={22} />}
        title={props.app.name}
        description={props.app.description}
        actions={props.actions}
      />
      <Show when={tabs().length > 0}>
        <NavTabs items={tabs()} />
      </Show>
      <Outlet />
    </div>
  )
}
