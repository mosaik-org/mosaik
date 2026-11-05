import { Field } from "@ark-ui/solid/field"
import type { ComponentProps } from "solid-js"
import { createSlotRecipeContext } from "../../styled-system/jsx"
import { field } from "../../styled-system/recipes"
import { CircleAlertIcon, type IconProps } from "./icons"

const { withProvider, withContext } = createSlotRecipeContext(field)

export type RootProps = ComponentProps<typeof Root>
export const Root = withProvider(Field.Root, "root")
export const RootProvider = withProvider(Field.RootProvider, "root")
export const ErrorText = withContext(Field.ErrorText, "errorText")
export const HelperText = withContext(Field.HelperText, "helperText")
export const Label = withContext(Field.Label, "label")
export const RequiredIndicator = withContext(Field.RequiredIndicator, "requiredIndicator")

/** Beside the error's words, in their colour and size: an error should not rest on its colour alone. */
export const ErrorIcon = (props: IconProps) => <CircleAlertIcon {...props} />

export { FieldContext as Context } from "@ark-ui/solid/field"
