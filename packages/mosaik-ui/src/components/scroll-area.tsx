import { ScrollArea } from "@ark-ui/solid/scroll-area"
import type { ComponentProps } from "solid-js"
import { createSlotRecipeContext } from "../../styled-system/jsx"
import { scrollArea } from "../../styled-system/recipes"

const { withProvider, withContext } = createSlotRecipeContext(scrollArea)

export type RootProps = ComponentProps<typeof Root>
export type ContentProps = ComponentProps<typeof Content>

export const Root = withProvider(ScrollArea.Root, "root")
export const RootProvider = withProvider(ScrollArea.RootProvider, "root")
export const Content = withContext(ScrollArea.Content, "content")
export const Corner = withContext(ScrollArea.Corner, "corner")
export const Thumb = withContext(ScrollArea.Thumb, "thumb")
const StyledScrollbar = withContext(ScrollArea.Scrollbar, "scrollbar")

/** With a `Thumb` by default, created inside the scrollbar, whose context the thumb reads. */
export const Scrollbar = (props: ComponentProps<typeof StyledScrollbar>) => (
  <StyledScrollbar {...props}>{props.children ?? <Thumb />}</StyledScrollbar>
)
export const Viewport = withContext(ScrollArea.Viewport, "viewport")

export { ScrollAreaContext as Context } from "@ark-ui/solid/scroll-area"
