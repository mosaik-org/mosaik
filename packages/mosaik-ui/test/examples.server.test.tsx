import type { Component } from "solid-js"
import { renderToString } from "solid-js/web"
import { describe, expect, it } from "vitest"

/** Every example renders to HTML on the server, as in a SolidStart app. */
const examples = import.meta.glob<{ App: Component }>("../catalog/examples/*/*.tsx", { eager: true })

describe.each(
  Object.entries(examples).map(
    ([path, module]) => [path.replace(/^.*examples\//, "").replace(/\.tsx$/, ""), module] as const,
  ),
)("%s", (_, module) => {
  it("renders on the server", () => {
    const html = renderToString(() => <module.App />)
    expect(html.length).toBeGreaterThan(0)
  })
})
