import { Field as ArkField } from "@ark-ui/solid/field"
import { createUniqueId, For, mergeProps, Show } from "solid-js"
import { FieldMessages, fieldStyles } from "./field"
import { inputRecipe } from "./input"

export interface TextFieldProps {
  label: string
  value: string
  onValueChange: (value: string) => void
  /** When focus leaves the field (forms show its error from then on). */
  onBlur?: () => void
  type?: string
  placeholder?: string
  helperText?: string
  errorText?: string
  required?: boolean
  disabled?: boolean
  autocomplete?: string
  name?: string
  /** A text area for longer text. */
  multiline?: boolean
  /** Values the browser offers while typing (single-line fields). */
  suggestions?: ReadonlyArray<string>
  maxLength?: number
}

export function TextField(props: TextFieldProps) {
  const merged = mergeProps({ type: "text" }, props)
  const listId = createUniqueId()

  return (
    <ArkField.Root
      class={fieldStyles.root}
      invalid={Boolean(merged.errorText)}
      required={merged.required}
      disabled={merged.disabled}
    >
      <ArkField.Label class={fieldStyles.label}>
        {merged.label}
        <ArkField.RequiredIndicator class={fieldStyles.requiredIndicator}>*</ArkField.RequiredIndicator>
      </ArkField.Label>
      <Show
        when={merged.multiline}
        fallback={
          <ArkField.Input
            class={inputRecipe()}
            type={merged.type}
            name={merged.name}
            value={merged.value}
            placeholder={merged.placeholder}
            autocomplete={merged.autocomplete}
            maxLength={merged.maxLength}
            list={merged.suggestions === undefined ? undefined : listId}
            onInput={(event) => merged.onValueChange(event.currentTarget.value)}
            onBlur={() => merged.onBlur?.()}
          />
        }
      >
        <ArkField.Textarea
          class={inputRecipe({ multiline: true })}
          name={merged.name}
          value={merged.value}
          placeholder={merged.placeholder}
          maxLength={merged.maxLength}
          onInput={(event) => merged.onValueChange(event.currentTarget.value)}
          onBlur={() => merged.onBlur?.()}
        />
      </Show>
      <Show when={merged.suggestions}>
        {(suggestions) => (
          <datalist id={listId}>
            <For each={suggestions()}>{(suggestion) => <option value={suggestion} />}</For>
          </datalist>
        )}
      </Show>
      <FieldMessages helperText={merged.helperText} errorText={merged.errorText} />
    </ArkField.Root>
  )
}
