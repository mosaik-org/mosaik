import { Combobox, type ComboboxRootProps, useComboboxContext } from "@ark-ui/solid/combobox"
import { Dialog as ArkDialog } from "@ark-ui/solid/dialog"
import { ark } from "@ark-ui/solid/factory"
import { type ComponentProps, type JSX, Show, splitProps } from "solid-js"
import { createSlotRecipeContext, type HTMLStyledProps } from "../../styled-system/jsx"
import { type CommandVariantProps, command } from "../../styled-system/recipes"
import { SearchIcon, XIcon } from "./icons"
import { Spinner } from "./spinner"

const { withProvider, withRootProvider, withContext } = createSlotRecipeContext(command)

export type DialogProps = ComponentProps<typeof Dialog>
/** A command palette over the page: wraps `Root`, in a `Portal` with `DialogBackdrop` and `DialogContent`. */
export const Dialog = withRootProvider(ArkDialog.Root, {
  defaultProps: () => ({ lazyMount: true, unmountOnExit: true }),
})
export const DialogTrigger = ArkDialog.Trigger
export const DialogBackdrop = withContext(ArkDialog.Backdrop, "backdrop")

const DialogPositioner = withContext(ArkDialog.Positioner, "positioner")
const StyledDialogContent = withContext(ArkDialog.Content, "dialogContent")
const DialogTitle = withContext(ArkDialog.Title, "dialogTitle")

export type DialogContentProps = ComponentProps<typeof StyledDialogContent> & {
  /** What the palette is called, for screen readers. */
  readonly title?: JSX.Element
}

export const DialogContent = (props: DialogContentProps) => {
  const [local, rest] = splitProps(props, ["title", "children"])
  return (
    <DialogPositioner>
      <StyledDialogContent {...rest}>
        <DialogTitle>{local.title ?? "Command palette"}</DialogTitle>
        {local.children}
      </StyledDialogContent>
    </DialogPositioner>
  )
}

const StyledRoot = withProvider(Combobox.Root, "root", {
  // A combobox whose list is always open, in the page rather than floating over it. Nothing stays
  // selected: picking an item runs it (`onSelect`), and a list that narrows as you type starts at
  // its best match.
  defaultProps: () => ({
    open: true,
    disableLayer: true,
    inputBehavior: "autohighlight" as const,
    selectionBehavior: "preserve" as const,
    value: [],
  }),
})

// The combobox's own props win: `onSelect` here is picking an item, not selecting text.
export type RootProps<T = unknown> = ComboboxRootProps<T> &
  Omit<HTMLStyledProps<"div">, keyof ComboboxRootProps<T>> &
  CommandVariantProps

/**
 * A search over a list of commands, driven by the keyboard. Which items match is the caller's: pass
 * them as a `collection`, narrowing it from `onInputValueChange` (`useListCollection` and `useFilter`,
 * or your own ranking or server search).
 */
export const Root = <T,>(props: RootProps<T>) => (
  // As the list opens, its first item is the one Enter runs.
  <StyledRoot defaultHighlightedValue={props.collection.firstValue} {...(props as RootProps)} />
)

export const Label = withContext(Combobox.Label, "label")
export const Control = withContext(Combobox.Control, "control")

const StyledIndicator = withContext(ark.div, "indicator")

export type IndicatorProps = ComponentProps<typeof StyledIndicator> & {
  /** Shows a spinner in place of the icon, while results are on their way. */
  readonly loading?: boolean
}

export const Indicator = (props: IndicatorProps) => {
  const [local, rest] = splitProps(props, ["loading", "children"])
  return (
    <StyledIndicator {...rest}>
      <Show when={local.loading} fallback={local.children ?? <SearchIcon />}>
        <Spinner size="sm" />
      </Show>
    </StyledIndicator>
  )
}

export const Input = withContext(Combobox.Input, "input")
export const ClearTrigger = withContext(Combobox.ClearTrigger, "clearTrigger", {
  defaultProps: () => ({ children: <XIcon /> }),
})
export const List = withContext(Combobox.Content, "list")
export const ItemGroup = withContext(Combobox.ItemGroup, "itemGroup")
export const ItemGroupLabel = withContext(Combobox.ItemGroupLabel, "itemGroupLabel")
export const Item = withContext(Combobox.Item, "item")
export const ItemIcon = withContext(ark.span, "itemIcon")
export const ItemContent = withContext(ark.span, "itemContent")
export const ItemText = withContext(Combobox.ItemText, "itemText")
export const ItemDescription = withContext(ark.span, "itemDescription")
/** Beside the item, e.g. a shortcut in `Kbd` or where the item leads. */
export const ItemCommand = withContext(ark.span, "itemCommand")
export const Separator = withContext(ark.div, "separator", {
  defaultProps: () => ({ role: "presentation" as const }),
})
export const Empty = withContext(Combobox.Empty, "empty")
export const Footer = withContext(ark.div, "footer")

export { ComboboxContext as Context } from "@ark-ui/solid/combobox"
export const useCommandContext = useComboboxContext
