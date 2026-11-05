import { PinInput } from "@ark-ui/solid/pin-input"
import type { ComponentProps } from "solid-js"
import { createSlotRecipeContext } from "../../styled-system/jsx"
import { pinInput } from "../../styled-system/recipes"

const { withProvider, withContext } = createSlotRecipeContext(pinInput)

export type RootProps = ComponentProps<typeof Root>
// `mask` is also a CSS property: forwarded, so it reaches Ark instead of becoming a style.
export const Root = withProvider(PinInput.Root, "root", {
  // Typed loosely: Panda's typing of forwarded props is too large for the compiler (TS2590).
  forwardProps: ["mask"] as never[],
})
export const RootProvider = withProvider(PinInput.RootProvider, "root")
export const Control = withContext(PinInput.Control, "control")
export const HiddenInput = PinInput.HiddenInput
export const Input = withContext(PinInput.Input, "input")
export const Label = withContext(PinInput.Label, "label")

export { PinInputContext as Context, usePinInput } from "@ark-ui/solid/pin-input"
