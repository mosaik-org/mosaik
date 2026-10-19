import type { AppAbout } from "@mosaik/platform/contract"
import { type Component, createContext, type JSX, useContext } from "solid-js"

/** A tab a host adds to an app's page (`/manage/<id>`), after the console's own. */
export interface AppTab {
  readonly id: string
  readonly label: string
  readonly component: Component<{ readonly about: AppAbout }>
}

/**
 * What a host adds to the console's pages: Core never knows about the Portal, the Portal
 * passes its parts in (e.g. an app's usage and where the directory lists it).
 */
export interface ConsoleExtensions {
  readonly appTabs?: ReadonlyArray<AppTab>
}

const ExtensionsContext = createContext<ConsoleExtensions>({})

export const ConsoleExtensionsProvider = (props: {
  readonly value: ConsoleExtensions
  readonly children: JSX.Element
}) => <ExtensionsContext.Provider value={props.value}>{props.children}</ExtensionsContext.Provider>

export const useConsoleExtensions = (): ConsoleExtensions => useContext(ExtensionsContext)
