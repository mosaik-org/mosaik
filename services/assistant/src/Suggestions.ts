import type { CatalogTool } from "@mosaik/tools"

/** How many questions the assistant suggests at once. */
export const SUGGESTIONS = 4

/**
 * Questions to suggest, from the examples of the tools the person can use: taken from each app in
 * turn, so one app with many examples does not crowd out the others.
 */
export const suggestionsFrom = (tools: ReadonlyArray<CatalogTool>, limit = SUGGESTIONS): ReadonlyArray<string> => {
  const byApp = new Map<string, Array<string>>()
  for (const tool of tools) byApp.set(tool.app, [...(byApp.get(tool.app) ?? []), ...tool.tool.examples])
  const chosen: Array<string> = []
  const queues = [...byApp.values()]
  for (let round = 0; chosen.length < limit && queues.some((queue) => round < queue.length); round++) {
    for (const queue of queues) {
      const example = queue[round]
      if (example !== undefined && !chosen.includes(example) && chosen.length < limit) chosen.push(example)
    }
  }
  return chosen
}
