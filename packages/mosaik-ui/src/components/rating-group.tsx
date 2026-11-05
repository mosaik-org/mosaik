import { RatingGroup, useRatingGroupContext, useRatingGroupItemContext } from "@ark-ui/solid/rating-group"
import { type ComponentProps, For, type JSX, splitProps } from "solid-js"
import { createSlotRecipeContext, type HTMLStyledProps } from "../../styled-system/jsx"
import { ratingGroup } from "../../styled-system/recipes"
import { StarIcon } from "./icons"

const { withProvider, withContext } = createSlotRecipeContext(ratingGroup)

export type RootProps = ComponentProps<typeof Root>
export const Root = withProvider(RatingGroup.Root, "root")
export const RootProvider = withProvider(RatingGroup.RootProvider, "root")
export const Item = withContext(RatingGroup.Item, "item")
export const Label = withContext(RatingGroup.Label, "label")

export const HiddenInput = RatingGroup.HiddenInput

export {
  RatingGroupContext as Context,
  RatingGroupItemContext as ItemContext,
  useRatingGroup,
} from "@ark-ui/solid/rating-group"

interface ItemIndicatorProps extends HTMLStyledProps<"span"> {
  icon?: JSX.Element | undefined
}

const StyledItemIndicator = withContext("span", "itemIndicator")

/**
 * The icon twice, stacked: the track (`data-bg`) and, over it, the part the rating fills
 * (`data-fg`, half of it for a half). Each read of `icon` makes a new element, as Solid's JSX
 * props are getters: one element can be in one place only.
 */
export const ItemIndicator = (props: ItemIndicatorProps) => {
  const [local, rest] = splitProps(props, ["icon"])
  const icon = () => local.icon ?? <StarIcon />
  const item = useRatingGroupItemContext()

  return (
    <StyledItemIndicator
      {...rest}
      data-highlighted={item().highlighted ? "" : undefined}
      data-checked={item().checked ? "" : undefined}
      data-half={item().half ? "" : undefined}
    >
      <span data-bg aria-hidden="true">
        {icon()}
      </span>
      <span data-fg aria-hidden="true">
        {icon()}
      </span>
    </StyledItemIndicator>
  )
}

interface ItemsProps extends Omit<ComponentProps<typeof Item>, "index"> {
  icon?: JSX.Element | undefined
}

export const Items = (props: ItemsProps) => {
  const [local, rest] = splitProps(props, ["icon"])
  const ratingGroup = useRatingGroupContext()

  return (
    <For each={ratingGroup().items}>
      {(item) => (
        <Item index={item} {...rest}>
          <ItemIndicator icon={local.icon} />
        </Item>
      )}
    </For>
  )
}

export const Control = withContext(RatingGroup.Control, "control", {
  defaultProps: () => ({ children: <Items /> }),
})
