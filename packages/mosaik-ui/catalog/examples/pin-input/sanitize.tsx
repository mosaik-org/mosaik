import { PinInput } from "@mosaik/mosaik-ui"

// Paste "12-34" or "12 34": what is not part of the code is dropped first.
export const App = () => (
  <PinInput.Root sanitizeValue={(value) => value.replace(/[\s-]/g, "")}>
    <PinInput.Label>Code</PinInput.Label>
    <PinInput.HiddenInput />
    <PinInput.Control>
      <PinInput.Input index={0} />
      <PinInput.Input index={1} />
      <PinInput.Input index={2} />
      <PinInput.Input index={3} />
    </PinInput.Control>
  </PinInput.Root>
)
