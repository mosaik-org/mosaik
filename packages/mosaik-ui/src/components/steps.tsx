import { ark } from "@ark-ui/solid/factory"
import { Steps } from "@ark-ui/solid/steps"
import type { ComponentProps } from "solid-js"
import { createSlotRecipeContext } from "../../styled-system/jsx"
import { steps } from "../../styled-system/recipes"

const { withProvider, withContext } = createSlotRecipeContext(steps)

export type RootProps = ComponentProps<typeof Root>
export const Root = withProvider(Steps.Root, "root")
export const RootProvider = withProvider(Steps.RootProvider, "root")
export const List = withContext(Steps.List, "list")
export const Item = withContext(Steps.Item, "item")
export const Trigger = withContext(Steps.Trigger, "trigger")
export const Indicator = withContext(Steps.Indicator, "indicator")
export const Separator = withContext(Steps.Separator, "separator")
export const Content = withContext(Steps.Content, "content")
export const CompletedContent = withContext(Steps.CompletedContent, "content")
export const NextTrigger = Steps.NextTrigger
export const PrevTrigger = Steps.PrevTrigger
export const Progress = withContext(Steps.Progress, "progress")
export const Title = withContext(ark.div, "title")
export const Description = withContext(ark.div, "description")

export { StepsContext as Context, StepsItemContext as ItemContext, useSteps } from "@ark-ui/solid/steps"
