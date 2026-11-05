import { ark } from "@ark-ui/solid/factory"
import { Slider, useSliderContext } from "@ark-ui/solid/slider"
import { type ComponentProps, For, Index, type JSX, Show, splitProps } from "solid-js"
import { createSlotRecipeContext } from "../../styled-system/jsx"
import { slider } from "../../styled-system/recipes"

const { withProvider, withContext } = createSlotRecipeContext(slider)

// `orientation` is both a variant and how it behaves: the recipe would keep it from the slider.
export const Root = withProvider(Slider.Root, "root", { forwardProps: ["orientation"] })
export const Control = withContext(Slider.Control, "control")
export const DraggingIndicator = withContext(Slider.DraggingIndicator, "draggingIndicator")
export const Label = withContext(Slider.Label, "label")
export const Marker = withContext(Slider.Marker, "marker")
export const MarkerIndicator = withContext(ark.div, "markerIndicator")
export const MarkerGroup = withContext(Slider.MarkerGroup, "markerGroup")
export const Range = withContext(Slider.Range, "range")
export const Thumb = withContext(Slider.Thumb, "thumb")
export const Track = withContext(Slider.Track, "track")
export const ValueText = withContext(Slider.ValueText, "valueText")
export const HiddenInput = Slider.HiddenInput

export { SliderContext as Context } from "@ark-ui/solid/slider"

export type RootProps = ComponentProps<typeof Root>
export type MarkerGroupProps = ComponentProps<typeof MarkerGroup>
export type ThumbProps = ComponentProps<typeof Thumb>

export interface MarksProps extends MarkerGroupProps {
  marks?: Array<number | { value: number; label: JSX.Element }> | undefined
}

export const Marks = (props: MarksProps) => {
  const [local, rest] = splitProps(props, ["marks"])
  if (!local.marks?.length) return null

  return (
    <MarkerGroup {...rest}>
      <For each={local.marks}>
        {(mark) => {
          const value = typeof mark === "number" ? mark : mark.value
          const label = typeof mark === "number" ? undefined : mark.label
          return (
            <Marker value={value}>
              <MarkerIndicator />
              <Show when={label != null}>
                <span>{label}</span>
              </Show>
            </Marker>
          )
        }}
      </For>
    </MarkerGroup>
  )
}

export const Thumbs = (props: Omit<ThumbProps, "index">) => {
  const slider = useSliderContext()
  return (
    // By position, not by value: `For` would make a new thumb as the value changes, taking focus
    // with it, so an arrow key moved it once and no more.
    <Index each={slider().value}>
      {(_, index) => (
        <Thumb index={index} {...props}>
          <HiddenInput />
        </Thumb>
      )}
    </Index>
  )
}
