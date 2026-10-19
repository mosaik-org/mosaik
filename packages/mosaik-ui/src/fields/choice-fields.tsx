import { createListCollection, useListCollection } from "@ark-ui/solid/collection"
import { useFilter } from "@ark-ui/solid/locale"
import { createEffect, createMemo, For, type JSX, on, Show, splitProps } from "solid-js"
import { Portal } from "solid-js/web"
import type {
  CheckboxVariantProps,
  ComboboxVariantProps,
  RadioGroupVariantProps,
  SelectVariantProps,
  SwitchRecipeVariantProps,
} from "../../styled-system/recipes"
import * as Checkbox from "../components/checkbox"
import * as Combobox from "../components/combobox"
import * as Fieldset from "../components/fieldset"
import * as RadioGroup from "../components/radio-group"
import * as Select from "../components/select"
import * as Switch from "../components/switch"
import { FIELD_PROPS, FIELD_PROPS_BESIDE, type FieldProps, FormField, isInvalid } from "./form-field"

/** One choice: what people read and the value the field gives. A string is both. */
export interface Option<T extends string = string> {
  readonly label: string
  readonly value: T
  readonly disabled?: boolean
}

/** The choices; a union of strings (`"open" | "closed"`) types the value the field gives. */
export type Options<T extends string = string> = ReadonlyArray<Option<T> | T>

const toOption = <T extends string>(item: Option<T> | T): Option<T> =>
  typeof item === "string" ? { label: item, value: item } : item

/** The value contract of a single choice: the chosen value, `null` for none. */
interface ChoiceValue<T extends string> {
  readonly items: Options<T>
  readonly value?: T | null
  readonly defaultValue?: T | null
  readonly onValueChange?: (value: T | null) => void
  readonly onBlur?: (event: FocusEvent) => void
}

const CHOICE_VALUE = ["items", "value", "defaultValue", "onValueChange", "onBlur", "name"] as const

/** `string | null` to Ark's array of values; `undefined` stays undefined, leaving Ark uncontrolled. */
const asArray = (value: string | null | undefined) => (value === undefined ? undefined : value === null ? [] : [value])

/** Opened into a portal, so they show above dialogs and clipped containers. */
interface Popup {
  readonly placeholder?: string
  /** Renders the list in place instead of in a portal at the end of the page. */
  readonly inline?: boolean
}

const Layer = (props: { inline?: boolean; children: JSX.Element }) => (
  <Show when={!props.inline} fallback={props.children}>
    <Portal>{props.children}</Portal>
  </Show>
)

export interface SelectFieldProps<T extends string = string>
  extends FieldProps,
    ChoiceValue<T>,
    Popup,
    SelectVariantProps {
  /** Shows a button that clears the choice. */
  readonly clearable?: boolean
  /** The name of a select without a visible `label`, such as a filter in a toolbar. */
  readonly "aria-label"?: string
}

/** A labeled dropdown of a few known choices: `<SelectField label="Status" items={["Open", "Closed"]} />`. */
export const SelectField = <T extends string = string>(props: SelectFieldProps<T>) => {
  const [field, local, rest] = splitProps(props, FIELD_PROPS, [
    ...CHOICE_VALUE,
    "placeholder",
    "inline",
    "clearable",
    "aria-label",
  ])
  const collection = createMemo(() =>
    createListCollection<Option<T>>({
      items: local.items.map(toOption),
      itemToString: (item) => item.label,
      itemToValue: (item) => item.value,
      isItemDisabled: (item) => item.disabled === true,
    }),
  )
  return (
    <FormField {...field}>
      <Select.Root
        collection={collection()}
        name={local.name}
        value={asArray(local.value)}
        defaultValue={asArray(local.defaultValue)}
        onValueChange={(details) => local.onValueChange?.((details.value[0] as T | undefined) ?? null)}
        {...rest}
      >
        <Select.Control>
          <Select.Trigger aria-label={local["aria-label"]} onBlur={(event) => local.onBlur?.(event)}>
            <Select.ValueText placeholder={local.placeholder} />
            <Select.IndicatorGroup>
              <Select.Indicator />
            </Select.IndicatorGroup>
          </Select.Trigger>
          <Show when={local.clearable}>
            <Select.ClearTrigger />
          </Show>
        </Select.Control>
        <Layer inline={local.inline}>
          <Select.Positioner>
            <Select.Content>
              <For each={collection().items}>
                {(item) => (
                  <Select.Item item={item}>
                    <Select.ItemText>{item.label}</Select.ItemText>
                    <Select.ItemIndicator />
                  </Select.Item>
                )}
              </For>
            </Select.Content>
          </Select.Positioner>
        </Layer>
        <Select.HiddenSelect />
      </Select.Root>
    </FormField>
  )
}

export interface ComboboxFieldProps<T extends string = string>
  extends FieldProps,
    ChoiceValue<T>,
    Popup,
    ComboboxVariantProps {
  /** Shown when nothing matches what was typed. */
  readonly emptyText?: JSX.Element
}

/**
 * A labeled input that filters many choices as people type (by label, ignoring case and accents).
 * For choices fetched as people type, compose `Combobox` parts.
 */
export const ComboboxField = <T extends string = string>(props: ComboboxFieldProps<T>) => {
  const [field, local, rest] = splitProps(props, FIELD_PROPS, [...CHOICE_VALUE, "placeholder", "inline", "emptyText"])
  const filters = useFilter({ sensitivity: "base" })
  const { collection, filter, set } = useListCollection<Option<T>>({
    initialItems: local.items.map(toOption),
    itemToString: (item) => item.label,
    itemToValue: (item) => item.value,
    isItemDisabled: (item) => item.disabled === true,
    filter: (text, query) => filters().contains(text, query),
  })
  createEffect(
    on(
      () => local.items,
      (items) => set(items.map(toOption)),
      { defer: true },
    ),
  )
  return (
    <FormField {...field}>
      <Combobox.Root
        collection={collection()}
        name={local.name}
        value={asArray(local.value)}
        defaultValue={asArray(local.defaultValue)}
        onValueChange={(details) => local.onValueChange?.((details.value[0] as T | undefined) ?? null)}
        onInputValueChange={(details) => filter(details.inputValue)}
        {...rest}
      >
        <Combobox.Control>
          <Combobox.Input placeholder={local.placeholder} onBlur={(event) => local.onBlur?.(event)} />
          <Combobox.IndicatorGroup>
            <Combobox.ClearTrigger />
            <Combobox.Trigger />
          </Combobox.IndicatorGroup>
        </Combobox.Control>
        <Layer inline={local.inline}>
          <Combobox.Positioner>
            <Combobox.Content>
              <Combobox.Empty>{local.emptyText ?? "No matches"}</Combobox.Empty>
              <For each={collection().items}>
                {(item) => (
                  <Combobox.Item item={item}>
                    <Combobox.ItemText>{item.label}</Combobox.ItemText>
                    <Combobox.ItemIndicator />
                  </Combobox.Item>
                )}
              </For>
            </Combobox.Content>
          </Combobox.Positioner>
        </Layer>
      </Combobox.Root>
    </FormField>
  )
}

export interface RadioGroupFieldProps<T extends string = string>
  extends Omit<FieldProps, "readOnly">,
    Omit<ChoiceValue<T>, "onBlur">,
    RadioGroupVariantProps {
  readonly orientation?: "horizontal" | "vertical"
}

/** A labeled set of radio buttons, for a few choices people should see at once. */
export const RadioGroupField = <T extends string = string>(props: RadioGroupFieldProps<T>) => {
  const [local, rest] = splitProps(props, [
    ...CHOICE_VALUE.filter((key) => key !== "onBlur"),
    "label",
    "helperText",
    "errorText",
    "optionalText",
    "invalid",
    "required",
    "disabled",
    "id",
    "class",
  ])
  return (
    <Fieldset.Root invalid={isInvalid(props)} disabled={local.disabled} id={local.id} class={local.class}>
      <Show when={local.label}>
        <Fieldset.Legend>{local.label}</Fieldset.Legend>
      </Show>
      <RadioGroup.Root
        name={local.name}
        value={local.value}
        defaultValue={local.defaultValue}
        onValueChange={(details) => local.onValueChange?.(details.value as T | null)}
        disabled={local.disabled}
        {...rest}
      >
        <For each={local.items.map(toOption)}>
          {(item) => (
            <RadioGroup.Item value={item.value} disabled={item.disabled}>
              <RadioGroup.ItemHiddenInput />
              <RadioGroup.ItemControl />
              <RadioGroup.ItemText>{item.label}</RadioGroup.ItemText>
            </RadioGroup.Item>
          )}
        </For>
      </RadioGroup.Root>
      <Show when={local.helperText && !isInvalid(props)}>
        <Fieldset.HelperText>{local.helperText}</Fieldset.HelperText>
      </Show>
      <Fieldset.ErrorText>{local.errorText}</Fieldset.ErrorText>
    </Fieldset.Root>
  )
}

/** The value contract of a yes/no field. */
interface BooleanValue {
  readonly checked?: boolean
  readonly defaultChecked?: boolean
  readonly onCheckedChange?: (checked: boolean) => void
  readonly onBlur?: (event: FocusEvent) => void
  /** Submitted for a checked box in a native form; `"on"` by default. */
  readonly value?: string
}

const BOOLEAN_VALUE = ["checked", "defaultChecked", "onCheckedChange", "onBlur", "name", "value", "label"] as const

export interface CheckboxFieldProps extends Omit<FieldProps, "optionalText">, BooleanValue, CheckboxVariantProps {}

/** A checkbox with its label beside it, and help or an error below: "I accept the terms". */
export const CheckboxField = (props: CheckboxFieldProps) => {
  const [field, local, rest] = splitProps(props, FIELD_PROPS_BESIDE, BOOLEAN_VALUE)
  return (
    <FormField {...field}>
      <Checkbox.Root
        checked={local.checked}
        defaultChecked={local.defaultChecked}
        onCheckedChange={(details) => local.onCheckedChange?.(details.checked === true)}
        name={local.name}
        value={local.value}
        {...rest}
      >
        <Checkbox.HiddenInput onBlur={(event) => local.onBlur?.(event)} />
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Show when={local.label}>
          <Checkbox.Label>{local.label}</Checkbox.Label>
        </Show>
      </Checkbox.Root>
    </FormField>
  )
}

export interface SwitchFieldProps extends Omit<FieldProps, "optionalText">, BooleanValue, SwitchRecipeVariantProps {}

/** An on/off switch with its label beside it, for a setting that applies at once. */
export const SwitchField = (props: SwitchFieldProps) => {
  const [field, local, rest] = splitProps(props, FIELD_PROPS_BESIDE, BOOLEAN_VALUE)
  return (
    <FormField {...field}>
      <Switch.Root
        checked={local.checked}
        defaultChecked={local.defaultChecked}
        onCheckedChange={(details) => local.onCheckedChange?.(details.checked)}
        name={local.name}
        value={local.value}
        {...rest}
      >
        <Switch.HiddenInput onBlur={(event) => local.onBlur?.(event)} />
        <Switch.Control />
        <Show when={local.label}>
          <Switch.Label>{local.label}</Switch.Label>
        </Show>
      </Switch.Root>
    </FormField>
  )
}
