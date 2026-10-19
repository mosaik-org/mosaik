import { Pagination, usePaginationContext } from "@ark-ui/solid/pagination"
import { type ComponentProps, For, type JSX } from "solid-js"
import { createSlotRecipeContext } from "../../styled-system/jsx"
import { pagination } from "../../styled-system/recipes"
import { IconButton } from "./icon-button"
import { EllipsisIcon } from "./icons"

const { withProvider, withContext } = createSlotRecipeContext(pagination)

export type RootProps = ComponentProps<typeof Root>
export const Root = withProvider(Pagination.Root, "root")
export const RootProvider = withProvider(Pagination.RootProvider, "root")
export const Item = withContext(Pagination.Item, "item")
export const Ellipsis = withContext(Pagination.Ellipsis, "ellipsis")
export const PrevTrigger = withContext(Pagination.PrevTrigger, "prevTrigger")
export const NextTrigger = withContext(Pagination.NextTrigger, "nextTrigger")

export { PaginationContext as Context } from "@ark-ui/solid/pagination"

export interface PaginationItemsProps extends JSX.HTMLAttributes<HTMLElement> {
  /**
   * One page's button: spread `item()` on it (it is the page's control, with its ARIA and events),
   * `<IconButton {...item()}>{page.value}</IconButton>`.
   */
  render: (
    page: { type: "page"; value: number; selected: boolean },
    item: () => JSX.HTMLAttributes<HTMLButtonElement>,
  ) => JSX.Element
  ellipsis?: JSX.Element | undefined
}

export const Items = (props: PaginationItemsProps) => {
  const ctx = usePaginationContext()

  return (
    <For each={ctx().pages}>
      {(page, index) => {
        if (page.type === "ellipsis") {
          return (
            <Ellipsis index={index()}>
              {props.ellipsis || (
                <IconButton as="span" colorPalette="gray">
                  <EllipsisIcon />
                </IconButton>
              )}
            </Ellipsis>
          )
        }

        return (
          <Item
            type="page"
            value={page.value}
            asChild={(item) => props.render({ ...page, selected: ctx().page === page.value }, item)}
          />
        )
      }}
    </For>
  )
}
