import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import postcss from "postcss"
import { afterAll, describe, expect, it } from "vitest"
import { appLayerOnly, appPostcssPlugins } from "./styles"

describe("appLayerOnly", () => {
  it("keeps the layer order and the utilities, drops the page's layers", async () => {
    const css = `@layer reset, base, tokens, recipes, utilities;
@layer reset { * { margin: 0 } }
@layer tokens { :root { --mk-colors-accent-9: #3e63dd } }
@layer recipes { .mk-button { display: flex } }
@layer utilities { .crm-px_4 { padding-inline: var(--mk-spacing-4) } }`
    const result = await postcss([appLayerOnly()]).process(css, { from: undefined })
    expect(result.css).toBe(`@layer reset, base, tokens, recipes, utilities;
@layer utilities { .crm-px_4 { padding-inline: var(--mk-spacing-4) } }`)
  })
})

describe("appPostcssPlugins", () => {
  const root = mkdtempSync(join(tmpdir(), "mosaik-app-styles-"))
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it("compiles nothing for an app without Panda", () => {
    expect(appPostcssPlugins(root)).toEqual([])
  })

  it("compiles an app's classes on the page's variables, defining none", async () => {
    writeFileSync(
      join(root, "panda.config.ts"),
      `import { appPandaConfig } from ${JSON.stringify(join(import.meta.dirname, "panda.ts"))}
export default appPandaConfig({ prefix: "crm", include: ["./page.ts"] })`,
    )
    writeFileSync(
      join(root, "page.ts"),
      `import { css } from "@mosaik/web-sdk/css"\nexport const card = css({ px: "4", bg: "accent.subtle.bg", _dark: { color: "fg.muted" } })\n`,
    )
    const result = await postcss([...appPostcssPlugins(root)]).process(
      "@layer reset, base, tokens, recipes, utilities;",
      {
        from: join(root, "styles.css"),
      },
    )
    // The app's classes, prefixed with its id, reading the theme's variables.
    expect(result.css).toContain(".crm-px_4")
    expect(result.css).toContain("var(--mk-colors-accent-subtle-bg)")
    expect(result.css).toContain(".dark .dark\\:crm-c_fg\\.muted")
    // No variable of the theme is defined, and no reset or recipe is repeated.
    expect(result.css).not.toMatch(/--mk-[\w-]+\s*:/)
    expect(result.css).not.toMatch(/--crm-/)
    expect(result.css).not.toContain("mk-button")
  }, 60_000)
})
