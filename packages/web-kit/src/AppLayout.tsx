import { useCan } from "@mosaik/auth/web"
import type { AnyApp } from "@mosaik/core"
import { css } from "@mosaik/styled-system/css"
import { AppIcon, PageHeader } from "@mosaik/ui"
import { Outlet } from "@tanstack/solid-router"
import { type JSX, Show } from "solid-js"
import { type NavTabItem, NavTabs } from "./NavTabs"

export interface AppLayoutProps {
  readonly app: AnyApp
  /** Sub-navigation; items with a `permission` are hidden from principals without it. */
  readonly nav?: ReadonlyArray<NavTabItem & { readonly permission?: string }>
  readonly actions?: JSX.Element
}

/** Standard frame for an app: header from the manifest, sub-navigation and the active page. */
export const AppLayout = (props: AppLayoutProps) => {
  const can = useCan()
  const visibleNav = () => (props.nav ?? []).filter((item) => item.permission === undefined || can(item.permission))

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "6" })}>
      <PageHeader
        icon={<AppIcon name={props.app.portal.icon} size={22} />}
        title={props.app.name}
        description={props.app.description}
        actions={props.actions}
      />
      <Show when={visibleNav().length > 1}>
        <NavTabs items={visibleNav()} />
      </Show>
      <Outlet />
    </div>
  )
}
