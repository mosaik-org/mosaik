import { type JSX, Show, splitProps } from "solid-js"
import { HStack } from "../../styled-system/jsx"
import type { NumberInputVariantProps, SliderVariantProps } from "../../styled-system/recipes"
import * as NumberInput from "../components/number-input"
import * as Slider from "../components/slider"
import { FIELD_PROPS, type FieldProps, FormField } from "./form-field"

interface Bounds {
  readonly min?: number
  readonly max?: number
  readonly step?: number
}

export interface NumberFieldProps extends FieldProps, Bounds, NumberInputVariantProps {
  /** The number; `null` while the input is empty. */
  readonly value?: number | null
  readonly defaultValue?: number | null
  readonly onValueChange?: (value: number | null) => void
  readonly onBlur?: (event: FocusEvent) => void
  readonly placeholder?: string
  /** How the number shows, e.g. `{ style: "currency", currency: "EUR" }`; the value stays a number. */
  readonly formatOptions?: Intl.NumberFormatOptions
  /** Hides the increment and decrement buttons. */
  readonly hideStepper?: boolean
}

const asText = (value: number | null | undefined) =>
  value === undefined ? undefined : value === null || Number.isNaN(value) ? "" : String(value)

/** A labeled number input with steppers, arrow keys and locale-aware formatting. */
export const NumberField = (props: NumberFieldProps) => {
  const [field, local, rest] = splitProps(props, FIELD_PROPS, [
    "value",
    "defaultValue",
    "onValueChange",
    "onBlur",
    "placeholder",
    "name",
    "hideStepper",
  ])
  return (
    <FormField {...field}>
      <NumberInput.Root
        value={asText(local.value)}
        defaultValue={asText(local.defaultValue)}
        onValueChange={(details) =>
          local.onValueChange?.(
            details.value === "" || Number.isNaN(details.valueAsNumber) ? null : details.valueAsNumber,
          )
        }
        name={local.name}
        {...rest}
      >
        <Show when={!local.hideStepper}>
          <NumberInput.Control />
        </Show>
        <NumberInput.Input placeholder={local.placeholder} onBlur={(event) => local.onBlur?.(event)} />
      </NumberInput.Root>
    </FormField>
  )
}

/** A mark under the track: a value, or a value with its label. */
export type SliderMark = number | { readonly value: number; readonly label: JSX.Element }

interface SliderOptions extends Bounds, SliderVariantProps {
  /** Labeled points along the track. */
  readonly marks?: ReadonlyArray<SliderMark>
  /** Shows the value next to the label (formatted by `format`). */
  readonly showValue?: boolean
  readonly format?: (value: number) => string
}

const SliderFrame = (
  props: FieldProps &
    SliderOptions & {
      readonly value?: number[]
      readonly defaultValue?: number[]
      readonly onValueChange?: (value: number[]) => void
      readonly onValueChangeEnd?: (value: number[]) => void
    },
) => {
  // Ark's slider does not read the field context: it gets the label and states itself, and
  // `FormField` adds only the help and the error.
  const [field, local, rest] = splitProps(
    props,
    ["helperText", "errorText", "invalid", "id", "class"],
    [
      "label",
      "optionalText",
      "value",
      "defaultValue",
      "onValueChange",
      "onValueChangeEnd",
      "marks",
      "showValue",
      "format",
      "name",
    ],
  )
  const text = (values: ReadonlyArray<number>) => values.map((value) => local.format?.(value) ?? value).join(" – ")
  return (
    <FormField {...field} disabled={rest.disabled} readOnly={rest.readOnly} required={rest.required}>
      <Slider.Root
        value={local.value}
        defaultValue={local.defaultValue}
        onValueChange={(details) => local.onValueChange?.(details.value)}
        onValueChangeEnd={(details) => local.onValueChangeEnd?.(details.value)}
        name={local.name}
        invalid={field.invalid || Boolean(field.errorText)}
        {...rest}
      >
        <Show when={local.label || local.showValue}>
          <HStack justify="space-between" gap="2">
            <Slider.Label>{local.label}</Slider.Label>
            <Show when={local.showValue}>
              <Slider.ValueText>
                <Slider.Context>{(slider) => text(slider().value)}</Slider.Context>
              </Slider.ValueText>
            </Show>
          </HStack>
        </Show>
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumbs />
        </Slider.Control>
        <Slider.Marks marks={local.marks as Slider.MarksProps["marks"]} />
      </Slider.Root>
    </FormField>
  )
}

export interface SliderFieldProps extends FieldProps, SliderOptions {
  readonly value?: number
  readonly defaultValue?: number
  /** Every value while dragging. */
  readonly onValueChange?: (value: number) => void
  /** The value once the thumb is released: for saving or fetching. */
  readonly onValueChangeEnd?: (value: number) => void
}

/** A labeled slider for one number within bounds. */
export const SliderField = (props: SliderFieldProps) => {
  const [local, rest] = splitProps(props, ["value", "defaultValue", "onValueChange", "onValueChangeEnd"])
  return (
    <SliderFrame
      value={local.value === undefined ? undefined : [local.value]}
      defaultValue={local.defaultValue === undefined ? undefined : [local.defaultValue]}
      onValueChange={(values) => values[0] !== undefined && local.onValueChange?.(values[0])}
      onValueChangeEnd={(values) => values[0] !== undefined && local.onValueChangeEnd?.(values[0])}
      {...rest}
    />
  )
}

export type Range = readonly [number, number]

export interface RangeSliderFieldProps extends FieldProps, SliderOptions {
  readonly value?: Range
  readonly defaultValue?: Range
  readonly onValueChange?: (value: Range) => void
  readonly onValueChangeEnd?: (value: Range) => void
  /** The smallest distance between the two thumbs. */
  readonly minStepsBetweenThumbs?: number
}

const asRange = (values: number[]): Range => [values[0] ?? 0, values[1] ?? values[0] ?? 0]

/** A labeled slider with two thumbs, for a range such as a price from–to. */
export const RangeSliderField = (props: RangeSliderFieldProps) => {
  const [local, rest] = splitProps(props, ["value", "defaultValue", "onValueChange", "onValueChangeEnd"])
  return (
    <SliderFrame
      value={local.value && [...local.value]}
      defaultValue={local.defaultValue && [...local.defaultValue]}
      onValueChange={(values) => local.onValueChange?.(asRange(values))}
      onValueChangeEnd={(values) => local.onValueChangeEnd?.(asRange(values))}
      {...rest}
    />
  )
}
