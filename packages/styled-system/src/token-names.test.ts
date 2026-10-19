import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * The theme's token names are a contract with installed apps: an app's classes read the page's
 * variables (`--mk-colors-accent-solid-bg`), built from the names the app knew when it was built.
 * A name that disappears unstyles every app using it until it is rebuilt, so removing or renaming
 * one is a platform major release. `token-names.txt` records them, for review to see the change.
 */
const PACKAGE = join(import.meta.dirname, "..")
const RECORDED = join(PACKAGE, "token-names.txt")

const current = (): ReadonlyArray<string> => {
  // The generated runtime's token table (`panda codegen`): every token, base and semantic.
  const source = readFileSync(join(PACKAGE, "generated/tokens/index.mjs"), "utf8")
  const table = source.match(/const tokens = (\{.*?\})\n/s)?.[1]
  if (table === undefined) throw new Error("No token table in generated/tokens/index.mjs")
  return Object.keys(JSON.parse(table) as Record<string, string>).sort()
}

describe("the theme's token names", () => {
  it("keep every name apps were built with", () => {
    const names = new Set(current())
    const recorded = readFileSync(RECORDED, "utf8").split("\n").filter(Boolean)
    // Removing or renaming a token breaks installed apps: a platform major release.
    expect(recorded.filter((name) => !names.has(name))).toEqual([])
  })

  it("are recorded (run the tests with -u after adding one)", async () => {
    await expect(`${current().join("\n")}\n`).toMatchFileSnapshot(RECORDED)
  })
})
