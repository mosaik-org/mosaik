import { Carousel, useCarouselContext } from "@ark-ui/solid/carousel"
import { type ComponentProps, For } from "solid-js"
import { createSlotRecipeContext } from "../../styled-system/jsx"
import { carousel } from "../../styled-system/recipes"

const { withProvider, withContext } = createSlotRecipeContext(carousel)

export type RootProps = ComponentProps<typeof Root>
// `page` is also a CSS property: forwarded, so it reaches Ark instead of becoming a style.
export const Root = withProvider(Carousel.Root, "root", {
  // Typed loosely: Panda's typing of forwarded props is too large for the compiler (TS2590).
  forwardProps: ["page"] as never[],
  defaultProps: () => ({ spacing: "16px" }),
})
export const RootProvider = withProvider(Carousel.RootProvider, "root")
export const AutoplayTrigger = withContext(Carousel.AutoplayTrigger, "autoplayTrigger")
export const Control = withContext(Carousel.Control, "control")
export const Indicator = withContext(Carousel.Indicator, "indicator")
export const Item = withContext(Carousel.Item, "item")
export const ItemGroup = withContext(Carousel.ItemGroup, "itemGroup")
export const NextTrigger = withContext(Carousel.NextTrigger, "nextTrigger")
export const PrevTrigger = withContext(Carousel.PrevTrigger, "prevTrigger")

const StyledIndicatorGroup = withContext(Carousel.IndicatorGroup, "indicatorGroup")
export const IndicatorGroup = (props: ComponentProps<typeof StyledIndicatorGroup>) => {
  const carousel = useCarouselContext()

  return (
    <StyledIndicatorGroup {...props}>
      <For each={carousel().pageSnapPoints}>{(_, index) => <Indicator index={index()} />}</For>
    </StyledIndicatorGroup>
  )
}

export { CarouselContext as Context } from "@ark-ui/solid/carousel"
