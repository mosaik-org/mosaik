import { type JSX, Show, splitProps } from "solid-js"
import type { InputVariantProps, TextareaVariantProps } from "../../styled-system/recipes"
import { Input, type InputProps } from "../components/input"
import { InputGroup } from "../components/input-group"
import * as PasswordInput from "../components/password-input"
import { Textarea, type TextareaProps } from "../components/textarea"
import { FIELD_PROPS, type FieldProps, FormField } from "./form-field"

/** The value contract of the text fields: the text, and every change to it. */
interface TextValue {
  readonly value?: string
  readonly defaultValue?: string
  /** Every keystroke's value (not a change event). */
  readonly onValueChange?: (value: string) => void
  readonly onBlur?: (event: FocusEvent) => void
  readonly placeholder?: string
  readonly autocomplete?: JSX.InputHTMLAttributes<HTMLInputElement>["autocomplete"]
}

const TEXT_VALUE = ["value", "defaultValue", "onValueChange", "onBlur", "placeholder", "autocomplete", "name"] as const

export interface TextFieldProps extends FieldProps, TextValue, InputVariantProps {
  readonly type?: "text" | "email" | "url" | "tel" | "search"
  /** Inside the input before the text, such as an icon. */
  readonly startElement?: JSX.Element
  /** Inside the input after the text, such as a unit. */
  readonly endElement?: JSX.Element
  /** Anything else for the `<input>` (`maxLength`, `inputMode`, `ref`, ...). */
  readonly inputProps?: InputProps
}

/** A labeled text input with help and an error: `<TextField label="Email" type="email" value={...} />`. */
export const TextField = (props: TextFieldProps) => {
  const [field, local, rest] = splitProps(props, FIELD_PROPS, [
    ...TEXT_VALUE,
    "type",
    "startElement",
    "endElement",
    "inputProps",
  ])
  const input = () => (
    <Input
      type={local.type ?? "text"}
      name={local.name}
      value={local.value ?? local.defaultValue ?? ""}
      placeholder={local.placeholder}
      autocomplete={local.autocomplete}
      onInput={(event) => local.onValueChange?.(event.currentTarget.value)}
      onBlur={(event) => local.onBlur?.(event)}
      {...rest}
      {...local.inputProps}
    />
  )
  return (
    <FormField {...field}>
      <Show when={local.startElement || local.endElement} fallback={input()}>
        <InputGroup startElement={local.startElement} endElement={local.endElement}>
          {input()}
        </InputGroup>
      </Show>
    </FormField>
  )
}

export interface TextareaFieldProps extends FieldProps, Omit<TextValue, "autocomplete">, TextareaVariantProps {
  /** Grows with its text instead of scrolling. */
  readonly autoresize?: boolean
  readonly rows?: number
  readonly textareaProps?: TextareaProps
}

/** A labeled multi-line text input; `autoresize` makes it grow with its text. */
export const TextareaField = (props: TextareaFieldProps) => {
  const [field, local, rest] = splitProps(props, FIELD_PROPS, [
    ...TEXT_VALUE.filter((key) => key !== "autocomplete"),
    "autoresize",
    "rows",
    "textareaProps",
  ] as const)
  return (
    <FormField {...field}>
      <Textarea
        name={local.name}
        value={local.value ?? local.defaultValue ?? ""}
        placeholder={local.placeholder}
        rows={local.rows}
        autoresize={local.autoresize}
        onInput={(event) => local.onValueChange?.(event.currentTarget.value)}
        onBlur={(event) => local.onBlur?.(event)}
        {...rest}
        {...local.textareaProps}
      />
    </FormField>
  )
}

export interface PasswordFieldProps extends FieldProps, TextValue, InputVariantProps {
  /** Shows the password as text; the eye button toggles it. */
  readonly visible?: boolean
  readonly onVisibleChange?: (visible: boolean) => void
  readonly inputProps?: InputProps
}

/** A labeled password input with a button that shows the password. */
export const PasswordField = (props: PasswordFieldProps) => {
  const [field, local, rest] = splitProps(props, FIELD_PROPS, [
    ...TEXT_VALUE,
    "visible",
    "onVisibleChange",
    "inputProps",
  ])
  return (
    <FormField {...field}>
      <PasswordInput.Root
        visible={local.visible}
        onVisibilityChange={(details) => local.onVisibleChange?.(details.visible)}
        autoComplete={local.autocomplete === "new-password" ? "new-password" : "current-password"}
      >
        <PasswordInput.Control>
          <PasswordInput.Input
            name={local.name}
            value={local.value ?? local.defaultValue ?? ""}
            placeholder={local.placeholder}
            onInput={(event) => local.onValueChange?.(event.currentTarget.value)}
            onBlur={(event) => local.onBlur?.(event)}
            {...rest}
            {...local.inputProps}
          />
          <PasswordInput.VisibilityTrigger>
            <PasswordInput.Indicator />
          </PasswordInput.VisibilityTrigger>
        </PasswordInput.Control>
      </PasswordInput.Root>
    </FormField>
  )
}
