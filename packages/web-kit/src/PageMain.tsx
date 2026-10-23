import { cva } from "@mosaik/styled-system/css"
import { useMatches } from "@tanstack/solid-router"
import type { Accessor, JSX } from "solid-js"

/**
 * How much of the screen a page takes:
 * - `contained` (the default): a centered column, for forms, settings and text, whose lines stay
 *   readable on wide screens;
 * - `wide`: the whole width, with the usual padding, for tables and dashboards;
 * - `full`: edge to edge, no padding, filling the height, for maps, boards and editors.
 */
export type PageLayout = "contained" | "wide" | "full"

declare module "@tanstack/solid-router" {
  interface StaticDataRouteOption {
    /** How much of the screen the page takes ({@link PageLayout}); the deepest route that says wins. */
    layout?: PageLayout
  }
}

/** The layout of the page shown: from the deepest route that declares one, `contained` otherwise. */
export const usePageLayout = (): Accessor<PageLayout> => {
  const matches = useMatches()
  return () => matches().findLast((match) => match.staticData?.layout !== undefined)?.staticData.layout ?? "contained"
}

const main = cva({
  base: { width: "full", minW: "0" },
  variants: {
    layout: {
      contained: { px: { base: "4", md: "8" }, py: "6", maxWidth: "7xl", mx: "auto" },
      wide: { px: { base: "4", md: "8" }, py: "6" },
      full: { flex: "1", display: "flex", flexDirection: "column", minH: "0" },
    },
  },
})

/**
 * Where the shell (or Core's console) puts the page, as wide as the page asks for: a page declares
 * it in its route, `staticData: { layout: "wide" }`, so the frame around it follows.
 */
export const PageMain = (props: { children: JSX.Element }) => {
  const layout = usePageLayout()
  return (
    <main class={main({ layout: layout() })} data-layout={layout()}>
      {props.children}
    </main>
  )
}
