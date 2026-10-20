import type { NumberSetting, Setting, TextSetting } from "@mosaik/core"
import { NumberField, SelectField, SwitchField, TextareaField, TextField } from "@mosaik/mosaik-ui"
import { type JSX, Match, Switch } from "solid-js"

export interface SettingFieldProps {
  readonly setting: Setting
  /** The value being edited; a value of the wrong kind shows as empty. */
  readonly value: unknown
  readonly onValueChange: (value: unknown) => void
  readonly name?: string
  /** Defaults to the setting's description. */
  readonly helperText?: JSX.Element
  readonly errorText?: string | undefined
  readonly required?: boolean
  readonly disabled?: boolean
}

/**
 * The field for a setting (see `Setting` in `@mosaik/core`), from its declaration: a text, a number
 * with its limits, a switch or a choice. What an app's settings and the Portal's config forms are
 * made of; check the value with `settingProblem`.
 */
export const SettingField = (props: SettingFieldProps) => {
  const helperText = () => props.helperText ?? props.setting.description
  const field = () => ({
    name: props.name,
    helperText: helperText(),
    errorText: props.errorText,
    required: props.required,
    disabled: props.disabled,
  })
  const as = <K extends Setting["kind"]>(kind: K) =>
    props.setting.kind === kind ? (props.setting as Extract<Setting, { kind: K }>) : undefined
  const text = () => (typeof props.value === "string" ? props.value : "")

  return (
    <Switch>
      <Match when={as("text")}>
        {(setting) => (
          <TextSettingField setting={setting()} value={text()} field={field()} onValueChange={props.onValueChange} />
        )}
      </Match>
      <Match when={as("number")}>
        {(setting) => (
          <NumberField
            {...field()}
            label={label(setting())}
            value={typeof props.value === "number" ? props.value : null}
            onValueChange={props.onValueChange}
            min={setting().min}
            max={setting().max}
            step={setting().integer === true ? 1 : undefined}
          />
        )}
      </Match>
      <Match when={as("boolean")}>
        {(setting) => (
          <SwitchField
            {...field()}
            label={setting().label}
            checked={props.value === true}
            onCheckedChange={props.onValueChange}
          />
        )}
      </Match>
      <Match when={as("choice")}>
        {(setting) => (
          <SelectField
            {...field()}
            label={setting().label}
            items={Object.entries(setting().options).map(([value, label]) => ({ value, label }))}
            value={text() || null}
            onValueChange={props.onValueChange}
          />
        )}
      </Match>
    </Switch>
  )
}

type Field = Pick<SettingFieldProps, "name" | "helperText" | "errorText" | "required" | "disabled">

/** The unit goes with the label: "Largest refund (EUR)". */
const label = (setting: NumberSetting) =>
  setting.unit === undefined ? setting.label : `${setting.label} (${setting.unit})`

/** A text on one line, or several. */
const TextSettingField = (props: {
  setting: TextSetting
  value: string
  field: Field
  onValueChange: (value: string) => void
}) =>
  props.setting.multiline === true ? (
    <TextareaField
      {...props.field}
      label={props.setting.label}
      value={props.value}
      onValueChange={props.onValueChange}
      maxLength={props.setting.maxLength}
      autoresize
    />
  ) : (
    <TextField
      {...props.field}
      label={props.setting.label}
      type={props.setting.format === "url" ? "url" : "text"}
      value={props.value}
      onValueChange={props.onValueChange}
      maxLength={props.setting.maxLength}
    />
  )
