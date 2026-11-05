import { Accordion } from "@ark-ui/solid/accordion"
import { ark } from "@ark-ui/solid/factory"
import type { ComponentProps } from "solid-js"
import { createSlotRecipeContext } from "../../styled-system/jsx"
import { accordion } from "../../styled-system/recipes"
import { ChevronDownIcon } from "./icons"

const { withProvider, withContext } = createSlotRecipeContext(accordion)

export type RootProps = ComponentProps<typeof Root>
export const Root = withProvider(Accordion.Root, "root")
export const RootProvider = withProvider(Accordion.RootProvider, "root")
export const Item = withContext(Accordion.Item, "item")
export const ItemContent = withContext(Accordion.ItemContent, "itemContent")
export const ItemIndicator = withContext(Accordion.ItemIndicator, "itemIndicator", {
  defaultProps: () => ({ children: <ChevronDownIcon /> }),
})
export const ItemTrigger = withContext(Accordion.ItemTrigger, "itemTrigger")
export const ItemBody = withContext(ark.div, "itemBody")

export { AccordionContext as Context, useAccordion } from "@ark-ui/solid/accordion"
