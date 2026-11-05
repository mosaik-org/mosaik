import { type AppColor, appColors, isAppColor } from "@mosaik/core"
import { cva } from "@mosaik/styled-system/css"

/** What an app's colour is read from: its id and, when it names one, `portal.color`. */
export interface Colored {
  readonly id: string
  readonly portal: { readonly color?: string | null | undefined }
}

/**
 * An app's colour: the one its manifest names, or one picked from its id (also for a name this
 * version does not know), so that every app has one and keeps it wherever and whenever it shows.
 */
export const appColor = (app: Colored): AppColor => {
  if (isAppColor(app.portal.color)) return app.portal.color
  // A small string hash (FNV-1a): stable across sessions and browsers.
  let hash = 0x811c9dc5
  for (let i = 0; i < app.id.length; i++) {
    hash ^= app.id.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return appColors[(hash >>> 0) % appColors.length] ?? "blue"
}

/**
 * The app's colour as the inherited palette (`colorPalette.*` inside reads it), for its icon and
 * nothing else around it. Each palette is listed so the stylesheet has it.
 */
export const appPalette = cva({
  base: {},
  variants: {
    color: {
      amber: { colorPalette: "amber" },
      blue: { colorPalette: "blue" },
      green: { colorPalette: "green" },
      indigo: { colorPalette: "indigo" },
      orange: { colorPalette: "orange" },
      pink: { colorPalette: "pink" },
      teal: { colorPalette: "teal" },
      violet: { colorPalette: "violet" },
    } satisfies Record<AppColor, object>,
  },
})

/** The class that gives an app's colour to what is inside: `class={appColorClass(app)}`. */
export const appColorClass = (app: Colored): string => appPalette({ color: appColor(app) })
