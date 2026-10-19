import { PasswordInput } from "@ark-ui/solid/password-input"
import type { ComponentProps } from "solid-js"
import { createSlotRecipeContext, styled } from "../../styled-system/jsx"
import { input, passwordInput } from "../../styled-system/recipes"
import { EyeIcon, EyeOffIcon } from "./icons"

const { withProvider, withContext } = createSlotRecipeContext(passwordInput)

export type RootProps = ComponentProps<typeof Root>
export const Root = withProvider(PasswordInput.Root, "root")
export const RootProvider = withProvider(PasswordInput.RootProvider, "root")
export const Label = withContext(PasswordInput.Label, "label")
export const Control = withContext(PasswordInput.Control, "control")
/** Styled like every other input (`size`, `variant`). */
export const Input = styled(PasswordInput.Input, input)
export const VisibilityTrigger = withContext(PasswordInput.VisibilityTrigger, "visibilityTrigger")

/** An eye while the password is hidden, a crossed eye while it shows; either can be replaced. */
export const Indicator = (props: ComponentProps<typeof PasswordInput.Indicator>) => (
  <PasswordInput.Indicator fallback={<EyeIcon />} {...props}>
    {props.children ?? <EyeOffIcon />}
  </PasswordInput.Indicator>
)

export { PasswordInputContext as Context } from "@ark-ui/solid/password-input"
