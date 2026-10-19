import { type JSX, Show, splitProps } from "solid-js"
import * as Field from "../components/field"

/**
 * What every ready-made field takes besides its value: a label, help, the error and the states
 * Ark's `Field` hands to the control inside (ids and ARIA links, `invalid`, `required`, ...).
 */
export interface FieldProps {
  /** The visible label; the control is named by it. */
  readonly label?: JSX.Element
  /** Help under the control, hidden while an error shows. */
  readonly helperText?: JSX.Element
  /** Why the value is not accepted. Setting it marks the field invalid. */
  readonly errorText?: JSX.Element
  /** Shown after the label of a field that is not `required`, such as "(optional)". */
  readonly optionalText?: JSX.Element
  /** Invalid without a message (the message shows elsewhere); `errorText` implies it. */
  readonly invalid?: boolean
  readonly required?: boolean
  readonly disabled?: boolean
  readonly readOnly?: boolean
  /** The name the value is submitted under in a native form. */
  readonly name?: string
  readonly id?: string
  readonly class?: string
}

/** The keys of `FieldProps` that go to `FormField`, for `splitProps`; `name` goes to the control. */
export const FIELD_PROPS = [
  "label",
  "helperText",
  "errorText",
  "optionalText",
  "invalid",
  "required",
  "disabled",
  "readOnly",
  "id",
  "class",
] as const satisfies ReadonlyArray<keyof FieldProps>

/** `FIELD_PROPS` for controls that show their label beside them (a checkbox), not above. */
export const FIELD_PROPS_BESIDE = FIELD_PROPS.filter((key) => key !== "label" && key !== "optionalText") as Array<
  Exclude<(typeof FIELD_PROPS)[number], "label" | "optionalText">
>

export const isInvalid = (props: FieldProps) => props.invalid === true || hasContent(props.errorText)

const hasContent = (element: JSX.Element) =>
  element !== undefined && element !== null && element !== false && element !== ""

export interface FormFieldProps extends Omit<FieldProps, "name"> {
  readonly children?: JSX.Element
}

/**
 * A label, any control, help and the error, linked for assistive technology. The ready-made fields
 * are built on it; use it for a control of your own that reads Ark's field context (any Ark input,
 * or `Field.Input`).
 */
export const FormField = (props: FormFieldProps) => {
  const [local, rest] = splitProps(props, ["label", "helperText", "errorText", "optionalText", "invalid", "children"])
  return (
    <Field.Root {...rest} invalid={isInvalid(props)}>
      <Show when={local.label}>
        <Field.Label>
          {local.label}
          <Field.RequiredIndicator fallback={local.optionalText} />
        </Field.Label>
      </Show>
      {local.children}
      <Show when={local.helperText && !isInvalid(props)}>
        <Field.HelperText>{local.helperText}</Field.HelperText>
      </Show>
      <Field.ErrorText>{local.errorText}</Field.ErrorText>
    </Field.Root>
  )
}
