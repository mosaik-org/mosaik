import type { AppColor } from "@mosaik/core"
import { css, cva, cx } from "@mosaik/styled-system/css"
import type { LucideProps } from "lucide-solid"
import Activity from "lucide-solid/icons/activity"
import Bell from "lucide-solid/icons/bell"
import Box from "lucide-solid/icons/box"
import Calendar from "lucide-solid/icons/calendar"
import ChartBar from "lucide-solid/icons/chart-bar"
import ChartLine from "lucide-solid/icons/chart-line"
import ChartPie from "lucide-solid/icons/chart-pie"
import Database from "lucide-solid/icons/database"
import FileText from "lucide-solid/icons/file-text"
import Gauge from "lucide-solid/icons/gauge"
import Globe from "lucide-solid/icons/globe"
import LayoutDashboard from "lucide-solid/icons/layout-dashboard"
import Mail from "lucide-solid/icons/mail"
import MapIcon from "lucide-solid/icons/map"
import Package from "lucide-solid/icons/package"
import Server from "lucide-solid/icons/server"
import Settings from "lucide-solid/icons/settings"
import Shield from "lucide-solid/icons/shield"
import ShoppingCart from "lucide-solid/icons/shopping-cart"
import Users from "lucide-solid/icons/users"
import Wallet from "lucide-solid/icons/wallet"
import type { Component } from "solid-js"
import { Dynamic } from "solid-js/web"
import { appPalette } from "./appColor"

const icons = {
  "chart-line": ChartLine,
  "chart-bar": ChartBar,
  "chart-pie": ChartPie,
  activity: Activity,
  shield: Shield,
  users: Users,
  settings: Settings,
  database: Database,
  server: Server,
  globe: Globe,
  wallet: Wallet,
  "shopping-cart": ShoppingCart,
  package: Package,
  "file-text": FileText,
  bell: Bell,
  "layout-dashboard": LayoutDashboard,
  gauge: Gauge,
  map: MapIcon,
  calendar: Calendar,
  mail: Mail,
  box: Box,
} satisfies Record<string, Component<LucideProps>>

export type AppIconName = keyof typeof icons

export const appIconNames = Object.keys(icons) as ReadonlyArray<AppIconName>

const isAppIconName = (name: string): name is AppIconName => Object.hasOwn(icons, name)

export interface AppIconProps {
  name?: string | null
  size?: number
  /** Drawn in the app's colour (see `appColor`); without it, in the text's. */
  color?: AppColor | undefined
}

const tinted = css({ color: "colorPalette.plain.fg" })

/** An app's icon by name (from its manifest); a box for apps without one, or with an unknown name. */
export function AppIcon(props: AppIconProps) {
  const icon = () => (props.name && isAppIconName(props.name) ? icons[props.name] : icons.box)
  return (
    <Dynamic
      component={icon()}
      size={props.size ?? 18}
      class={props.color === undefined ? undefined : cx(appPalette({ color: props.color }), tinted)}
      aria-hidden="true"
    />
  )
}

const tile = cva({
  base: {
    display: "grid",
    placeItems: "center",
    flexShrink: "0",
    bg: "colorPalette.subtle.bg",
    color: "colorPalette.subtle.fg",
  },
  variants: {
    size: {
      sm: { boxSize: "7", borderRadius: "l2" },
      md: { boxSize: "10", borderRadius: "l3" },
    },
  },
  defaultVariants: { size: "md" },
})

/**
 * An app's icon on a tile of its colour, where an app is listed (cards, rows); grey without a
 * colour, as for an app the person cannot open.
 */
export function AppTile(props: { name?: string | null; color?: AppColor | undefined; size?: "sm" | "md" }) {
  return (
    <span
      class={cx(tile({ size: props.size }), props.color === undefined ? undefined : appPalette({ color: props.color }))}
      aria-hidden="true"
    >
      <AppIcon name={props.name} size={props.size === "sm" ? 14 : 20} />
    </span>
  )
}
