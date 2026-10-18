import { Field as ArkField } from "@ark-ui/solid/field"
import { css } from "@mosaik/styled-system/css"
import { type JSX, Show } from "solid-js"

export const fieldStyles = {
  root: css({ display: "flex", flexDirection: "column", gap: "1.5", w: "full" }),
  label: css({
    display: "inline-flex",
    gap: "0.5",
    fontSize: "sm",
    fontWeight: "medium",
    color: "fg.default",
    _disabled: { opacity: "0.6" },
  }),
  requiredIndicator: css({ color: "danger.default" }),
  helperText: css({ fontSize: "xs", color: "fg.muted" }),
  errorText: css({ fontSize: "xs", color: "danger.text" }),
}

export interface FieldProps {
  label: string
  helperText?: JSX.Element
  errorText?: JSX.Element
  required?: boolean
  disabled?: boolean
  children: JSX.Element
}

export function Field(props: FieldProps) {
  return (
    <ArkField.Root
      class={fieldStyles.root}
      invalid={Boolean(props.errorText)}
      required={props.required}
      disabled={props.disabled}
    >
      <ArkField.Label class={fieldStyles.label}>
        {props.label}
        <ArkField.RequiredIndicator class={fieldStyles.requiredIndicator}>*</ArkField.RequiredIndicator>
      </ArkField.Label>
      {props.children}
      <FieldMessages helperText={props.helperText} errorText={props.errorText} />
    </ArkField.Root>
  )
}

export function FieldMessages(props: { helperText?: JSX.Element; errorText?: JSX.Element }) {
  return (
    <Show
      when={props.errorText}
      fallback={
        <Show when={props.helperText}>
          {(helperText) => <ArkField.HelperText class={fieldStyles.helperText}>{helperText()}</ArkField.HelperText>}
        </Show>
      }
    >
      {(errorText) => <ArkField.ErrorText class={fieldStyles.errorText}>{errorText()}</ArkField.ErrorText>}
    </Show>
  )
}
