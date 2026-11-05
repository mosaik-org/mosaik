import { Tabs } from "@ark-ui/solid/tabs"
import type { ComponentProps } from "solid-js"
import { createSlotRecipeContext } from "../../styled-system/jsx"
import { tabs } from "../../styled-system/recipes"

const { withProvider, withContext } = createSlotRecipeContext(tabs)

export type RootProps = ComponentProps<typeof Root>
export const Root = withProvider(Tabs.Root, "root")
export const RootProvider = withProvider(Tabs.RootProvider, "root")
export const List = withContext(Tabs.List, "list")
export const Trigger = withContext(Tabs.Trigger, "trigger")
export const Content = withContext(Tabs.Content, "content")

export { TabsContext as Context, useTabs } from "@ark-ui/solid/tabs"
