import { describe, expect, it } from "vitest"
import { GROUPS } from "../catalog/nav"
import { COLORS } from "../catalog/showcase"
import { palettes } from "../src/theme/colors"
import * as recipes from "../styled-system/recipes"

/** Every example's source, by `<component>/<example>`, and every recipe's, by its name. */
const exampleFiles = import.meta.glob<string>("../catalog/examples/*/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
})
const recipeFiles = import.meta.glob<string>("../src/theme/recipes/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
})

const folderOf = (path: string) => path.split("/").at(-2) ?? ""
const folders = [...new Set(Object.keys(exampleFiles).map(folderOf))]

const kebab = (name: string) => name.replace(/Recipe$/, "").replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

const sourcesOf = (folder: string) =>
  Object.entries(exampleFiles)
    .filter(([path]) => folderOf(path) === folder)
    .map(([, source]) => source)

const withVariants = Object.entries(
  recipes as unknown as Record<string, { variantMap?: Record<string, ReadonlyArray<string>> }>,
)
  .filter(([, recipe]) => recipe.variantMap !== undefined)
  .map(([name, recipe]) => [kebab(name), recipe.variantMap ?? {}] as const)

/** Parts of another component's examples, or with nothing to look at on their own: why each is left out. */
const NOT_ON_THEIR_OWN = new Set([
  // Parts of `Command`, `Select` and others; there is no such component.
  "listbox",
  // Under Theme, as part of `ThemeChoice`.
  "theme-choice",
])

/** Variants with only one of a kind of value, or that a prop or state sets rather than people choosing. */
const NOT_CHOSEN: Readonly<Record<string, ReadonlyArray<string>>> = {
  // Follows `Skeleton`'s own `loading`, shown in its `loading` example.
  skeleton: ["loading"],
  // Set by which pattern it is: `EmptyState` is neutral, `ErrorState` is danger; both in `basic`.
  "empty-state": ["tone"],
}

/** Recipes that read a palette only for a focus ring or the like: a color would not show. */
const NO_COLORS = new Set([
  "accordion",
  "alert", // `status` picks its color, shown in `status`.
  "carousel",
  "combobox",
  "date-picker", // Its selected day, in the accent; shown by the Accent control.
  "empty-state", // `tone` picks its color, shown in `tones`.
  "file-upload",
  "input",
  "menu",
  "select",
  "textarea",
  "toast", // Its type picks its color, shown in `types`.
])

describe("the catalog", () => {
  it("lists every component in the sidebar", () => {
    const listed = new Set(GROUPS.flatMap((group) => group.items))
    expect(folders.filter((folder) => !listed.has(folder))).toEqual([])
  })

  it("has a folder for everything in the sidebar", () => {
    expect(GROUPS.flatMap((group) => group.items).filter((item) => !folders.includes(item))).toEqual([])
  })

  it("offers every palette and role as a color", () => {
    const roles = ["gray", "accent", "danger", "success", "warning"]
    expect([...COLORS].sort()).toEqual([...roles, ...Object.keys(palettes)].sort())
  })

  describe.each(withVariants.filter(([name]) => !NOT_ON_THEIR_OWN.has(name)))("%s", (name, variants) => {
    const sources = sourcesOf(name)

    it("has examples", () => {
      expect(sources.length).toBeGreaterThan(0)
    })

    it.each(Object.entries(variants).filter(([key, values]) => values.length > 1 && !NOT_CHOSEN[name]?.includes(key)))(
      "shows every %s",
      (key, values) => {
        // By reading the values from the recipe, which keeps up by itself, or by naming each one.
        if (sources.some((source) => source.includes(`.variantMap.${key}`))) return
        const missing = values.filter(
          (value) => value !== "true" && value !== "false" && !sources.some((source) => source.includes(`"${value}"`)),
        )
        expect(missing).toEqual([])
      },
    )

    const hasColors = recipeFiles[`../src/theme/recipes/${name}.ts`]?.includes("colorPalette.") === true
    it.runIf(hasColors && !NO_COLORS.has(name))("shows every color", () => {
      expect(sources.some((source) => source.includes("COLORS"))).toBe(true)
    })
  })
})
