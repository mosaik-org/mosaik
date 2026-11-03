import { Result, Schema } from "effect"
import { BrowserTools, isBrowserTool, type Resolution, type ToolCallPart } from "../contract"
import type { AssistantBrowser } from "./browser"

/** At most this many places go back to the model per search. */
export const PLACES_LIMIT = 10

/** A path in Mosaik: never another site (`//evil.example` is one). */
export const isLocalPath = (path: string): boolean => path.startsWith("/") && !path.startsWith("//")

/** What running a browser call came to: its result for the model, and where to take the person, if anywhere. */
export interface BrowserOutcome {
  readonly resolution: Extract<Resolution, { readonly type: "result" }>
  /** Followed once the turn is over, so the reply finishes where the person asked. */
  readonly navigateTo?: string
}

const result = (call: ToolCallPart, ok: boolean, text: string): BrowserOutcome["resolution"] => ({
  type: "result",
  call: call.id,
  ok,
  text,
})

/**
 * Runs one of the {@link BrowserTools} the model called: checks its input as the contract says,
 * then asks the frame. Never throws: a failure is a result the model reads.
 */
export const runBrowserCall = async (
  call: ToolCallPart,
  browser: AssistantBrowser | undefined,
): Promise<BrowserOutcome> => {
  if (!isBrowserTool(call.tool)) return { resolution: result(call, false, `${call.tool} is not a browser tool`) }
  if (browser === undefined) {
    return { resolution: result(call, false, "This window cannot find or open pages: link to none.") }
  }
  switch (call.tool) {
    case "find_pages": {
      const input = Schema.decodeUnknownResult(BrowserTools.find_pages.input)(call.input)
      if (Result.isFailure(input)) return { resolution: result(call, false, `Invalid input: ${input.failure.message}`) }
      try {
        const places = (await browser.findPlaces(input.success.query)).slice(0, PLACES_LIMIT)
        return {
          resolution: result(
            call,
            true,
            places.length === 0 ? `Nothing found for “${input.success.query}”.` : JSON.stringify(places),
          ),
        }
      } catch (error) {
        return {
          resolution: result(call, false, `The search failed: ${error instanceof Error ? error.message : error}`),
        }
      }
    }
    case "open_page": {
      const input = Schema.decodeUnknownResult(BrowserTools.open_page.input)(call.input)
      if (Result.isFailure(input)) return { resolution: result(call, false, `Invalid input: ${input.failure.message}`) }
      const { path, title } = input.success
      if (!isLocalPath(path)) return { resolution: result(call, false, `${path} is not a page of Mosaik`) }
      return { resolution: result(call, true, `Opened ${title ?? path}.`), navigateTo: path }
    }
  }
}
