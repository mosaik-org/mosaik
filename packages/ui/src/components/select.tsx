import { Select as ArkSelect, createListCollection } from "@ark-ui/solid/select"
import { cx, sva } from "@mosaik/styled-system/css"
import Check from "lucide-solid/icons/check"
import ChevronDown from "lucide-solid/icons/chevron-down"
import { createMemo, For, mergeProps, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { fieldStyles } from "./field"
import { popoverContentStyles, popoverItemRecipe } from "./popover-styles"

const select = sva({
  slots: ["root", "trigger", "valueText", "indicator", "itemIndicator"],
  base: {
    root: { display: "flex", flexDirection: "column", gap: "1.5", minW: "0" },
    trigger: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "2",
      w: "full",
      bg: "bg.surface",
      color: "fg.default",
      borderWidth: "1px",
      borderColor: "border.default",
      borderRadius: "control",
      cursor: "pointer",
      outline: "none",
      textAlign: "start",
      transitionProperty: "border-color, box-shadow",
      transitionDuration: "fast",
      _hover: { borderColor: "border.emphasized" },
      _focusVisible: { borderColor: "accent.default", boxShadow: "0 0 0 1px {colors.accent.default}" },
      _disabled: { opacity: "0.6", cursor: "not-allowed" },
    },
    valueText: {
      flex: "1",
      truncate: true,
      "&[data-placeholder-shown]": { color: "fg.subtle" },
    },
    indicator: {
      display: "flex",
      color: "fg.muted",
      transition: "transform 150ms",
      _open: { transform: "rotate(180deg)" },
      "& svg": { boxSize: "4" },
    },
    itemIndicator: { ms: "auto", display: "flex", "& svg": { color: "accent.default" } },
  },
  variants: {
    size: {
      sm: { trigger: { h: "8", px: "2.5", fontSize: "sm" } },
      md: { trigger: { h: "9", px: "3", fontSize: "sm" } },
    },
  },
  defaultVariants: { size: "md" },
})

export interface SelectItem<T extends string> {
  value: T
  label: string
}

export interface SelectProps<T extends string> {
  label?: string
  "aria-label"?: string
  items: ReadonlyArray<SelectItem<T>>
  value: T | undefined
  onValueChange: (value: T) => void
  placeholder?: string
  size?: "sm" | "md"
  disabled?: boolean
  class?: string
}

export function Select<T extends string>(props: SelectProps<T>) {
  const merged = mergeProps({ size: "md" as const }, props)
  const classes = createMemo(() => select({ size: merged.size }))
  const collection = createMemo(() => createListCollection<SelectItem<T>>({ items: [...merged.items] }))

  return (
    <ArkSelect.Root
      class={cx(classes().root, merged.class)}
      collection={collection()}
      value={merged.value === undefined ? [] : [merged.value]}
      onValueChange={(details) => {
        const [next] = details.value
        if (next !== undefined) merged.onValueChange(next as T)
      }}
      disabled={merged.disabled}
      positioning={{ sameWidth: true, gutter: 4 }}
      lazyMount
      unmountOnExit
    >
      <Show when={merged.label}>
        {(label) => <ArkSelect.Label class={fieldStyles.label}>{label()}</ArkSelect.Label>}
      </Show>
      <ArkSelect.Control>
        <ArkSelect.Trigger class={classes().trigger} aria-label={merged["aria-label"]}>
          <ArkSelect.ValueText class={classes().valueText} placeholder={merged.placeholder} />
          <ArkSelect.Indicator class={classes().indicator}>
            <ChevronDown />
          </ArkSelect.Indicator>
        </ArkSelect.Trigger>
      </ArkSelect.Control>
      <Portal>
        <ArkSelect.Positioner>
          <ArkSelect.Content class={popoverContentStyles}>
            <For each={collection().items}>
              {(item) => (
                <ArkSelect.Item item={item} class={popoverItemRecipe()}>
                  <ArkSelect.ItemText>{item.label}</ArkSelect.ItemText>
                  <ArkSelect.ItemIndicator class={classes().itemIndicator}>
                    <Check />
                  </ArkSelect.ItemIndicator>
                </ArkSelect.Item>
              )}
            </For>
          </ArkSelect.Content>
        </ArkSelect.Positioner>
      </Portal>
      <ArkSelect.HiddenSelect />
    </ArkSelect.Root>
  )
}
