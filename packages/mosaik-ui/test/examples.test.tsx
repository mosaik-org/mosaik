import { render } from "@solidjs/testing-library"
import type { Component } from "solid-js"
import { describe, it } from "vitest"
import * as demo from "../catalog/demo"
import { expectAccessible } from "./axe"

/**
 * Every example in the catalog renders, and axe finds nothing in it: the parts as people compose
 * them, not only the ready-made fields.
 */
const examples = {
  ...import.meta.glob<{ App: Component }>("../catalog/examples/*/*.tsx", { eager: true }),
  // The demo: the components together, as an app uses them.
  "examples/demo/index.tsx": demo,
}

/**
 * Checks axe gets wrong for a component, with why. Steps: Ark's list is a `tablist` that owns its
 * tabs through `aria-owns`, nested in the items; axe does not follow `aria-owns` there.
 */
const SKIP: Record<string, ReadonlyArray<string>> = {
  steps: ["aria-required-children"],
  demo: ["aria-required-children"],
}

describe.each(
  Object.entries(examples).map(
    ([path, module]) => [path.replace(/^.*examples\//, "").replace(/\.tsx$/, ""), module] as const,
  ),
)("%s", (name, module) => {
  it("renders and is accessible", async () => {
    const { container } = render(() => <module.App />)
    await expectAccessible(container, SKIP[name.split("/")[0] ?? ""])
  })
})
