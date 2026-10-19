import axe from "axe-core"
import { expect } from "vitest"

/**
 * No accessibility violations axe can find in a DOM without layout (so not color contrast, which
 * the catalog's screenshots cover).
 */
export const expectAccessible = async (container: Element, skip: ReadonlyArray<string> = []) => {
  const rules = Object.fromEntries(["color-contrast", "region", ...skip].map((rule) => [rule, { enabled: false }]))
  const results = await axe.run(container, { rules })
  expect(
    results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.html).join(", ")}`),
  ).toEqual([])
}
