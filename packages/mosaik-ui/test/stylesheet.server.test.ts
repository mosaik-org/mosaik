import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, expect, it } from "vitest"

const PACKAGE = join(import.meta.dirname, "..")
const work = mkdtempSync(join(tmpdir(), "mosaik-ui-css-"))
afterAll(() => rmSync(work, { recursive: true, force: true }))

const classes = (css: string) => new Set(css.match(/\.mk-[A-Za-z0-9_\\:\-.%/]+/g))
const cssgen = (name: string, include?: string) => {
  const outfile = join(work, `${name}.css`)
  const args = ["cssgen", "--silent", "--outfile", outfile, ...(include ? ["--include", include] : [])]
  execFileSync(join(PACKAGE, "node_modules/.bin/panda"), args, { cwd: PACKAGE })
  return classes(readFileSync(outfile, "utf8"))
}

/**
 * Apps and themed builds compile the library's styles from its preset alone, never scanning its
 * components: anything a component styles inline has to be in the preset's `staticCss`.
 */
it("the preset alone produces every class the components use", () => {
  const scanned = cssgen("scanned")
  const preset = cssgen("preset", "nothing/**")
  expect([...scanned].filter((name) => !preset.has(name))).toEqual([])
}, 60_000)
