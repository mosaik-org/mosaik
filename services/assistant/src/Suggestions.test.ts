import { describe, expect, it } from "@effect/vitest"
import { AppTool } from "@mosaik/platform/contract"
import { type CatalogTool, inputSchema } from "@mosaik/tools"
import { suggestionsFrom } from "./Suggestions"

const tool = (app: string, examples: ReadonlyArray<string>): CatalogTool => {
  const appTool = new AppTool({
    name: "things.list",
    title: "Things",
    description: "Lists things",
    examples,
    method: "GET",
    path: `/api/${app}/things`,
    permission: `${app}:view`,
    readOnly: true,
    destructive: false,
    params: null,
    query: null,
    payload: null,
  })
  return {
    name: `${app}_things_list`,
    app,
    upstream: new URL("http://app"),
    tool: appTool,
    input: inputSchema(appTool),
    fingerprint: app,
  }
}

describe("suggestionsFrom", () => {
  it("takes from each app in turn, without repeats, up to the limit", () => {
    const tools = [tool("sales", ["S1", "S2", "S3"]), tool("issues", ["I1"]), tool("sales", ["S1", "S4"])]
    expect(suggestionsFrom(tools, 4)).toEqual(["S1", "I1", "S2", "S3"])
    expect(suggestionsFrom([tool("sales", [])])).toEqual([])
  })
})
