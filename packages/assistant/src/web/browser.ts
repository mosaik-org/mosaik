import { createContext, useContext } from "solid-js"
import type { Place } from "../contract"

/**
 * What the assistant needs from the frame showing it (the shell) to run its browser tools: finding
 * places as its search does, and taking the person to one. The assistant's package knows no
 * router and no search of its own; without a frame that provides these, browser tools fail and
 * say so to the model.
 */
export interface AssistantBrowser {
  /** Pages and records the person can open that match the query, as the frame's search finds them. */
  readonly findPlaces: (query: string) => Promise<ReadonlyArray<Place>>
  /** Takes the person to a path of Mosaik, with the conversation beside the page. */
  readonly openPage: (path: string, conversation: string) => void
  /** An app's name, from its id (the app a tool belongs to). */
  readonly appName?: (app: string) => string | undefined
}

const AssistantBrowserContext = createContext<AssistantBrowser>()

export const AssistantBrowserProvider = AssistantBrowserContext.Provider

export const useAssistantBrowser = (): AssistantBrowser | undefined => useContext(AssistantBrowserContext)

/** An app's name as people know it, or its id without a frame that knows. */
export const useAppName = (): ((app: string) => string) => {
  const browser = useAssistantBrowser()
  return (app) => browser?.appName?.(app) ?? app
}
