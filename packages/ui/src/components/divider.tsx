import { css, cva, cx } from "@mosaik/styled-system/css"
import { type JSX, mergeProps, Show } from "solid-js"

const divider = cva({
  base: { flexShrink: "0", borderWidth: "0", borderColor: "border.default", borderStyle: "solid" },
  variants: {
    orientation: {
      horizontal: { w: "full", borderTopWidth: "1px" },
      vertical: { alignSelf: "stretch", borderInlineStartWidth: "1px" },
    },
  },
  defaultVariants: { orientation: "horizontal" },
})

const labelled = css({
  display: "flex",
  alignItems: "center",
  gap: "3",
  fontSize: "xs",
  color: "fg.subtle",
  textTransform: "uppercase",
  letterSpacing: "wide",
  _before: { content: '""', flex: "1", borderTopWidth: "1px", borderColor: "border.default" },
  _after: { content: '""', flex: "1", borderTopWidth: "1px", borderColor: "border.default" },
})

export interface DividerProps {
  orientation?: "horizontal" | "vertical"
  /** Text in the middle of a horizontal divider, e.g. "or". */
  label?: JSX.Element
  class?: string
}

export function Divider(props: DividerProps) {
  const merged = mergeProps({ orientation: "horizontal" as const }, props)
  return (
    <Show
      when={merged.label !== undefined && merged.orientation === "horizontal"}
      fallback={
        <hr
          aria-orientation={merged.orientation}
          class={cx(divider({ orientation: merged.orientation }), merged.class)}
        />
      }
    >
      {/* biome-ignore lint/a11y/useSemanticElements: <hr> cannot contain a label */}
      <div role="separator" class={cx(labelled, merged.class)}>
        {merged.label}
      </div>
    </Show>
  )
}
