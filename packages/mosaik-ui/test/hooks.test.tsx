import { describe, expect, it } from "vitest"
import * as ui from "../src"

/** Every component that can be driven from outside gives teams the hook to do it, not only the part. */
const withRootProvider = Object.entries(ui).filter(
  ([, part]) => typeof part === "object" && part !== null && "RootProvider" in part,
) as ReadonlyArray<[string, Record<string, unknown>]>

describe("hooks", () => {
  it("finds the components", () => {
    expect(withRootProvider.length).toBeGreaterThan(30)
  })

  it.each(withRootProvider)("%s exports the hook its RootProvider takes", (_, part) => {
    const hooks = Object.keys(part).filter((key) => /^use[A-Z]/.test(key) && !key.endsWith("Context"))
    expect(hooks).not.toEqual([])
  })
})
