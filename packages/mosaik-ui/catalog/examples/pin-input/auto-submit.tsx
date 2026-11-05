import { PinInput, Text } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"

// Submits its form as the last digit goes in, with no button to press.
export const App = () => {
  const [sent, setSent] = createSignal(false)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        setSent(true)
      }}
    >
      <PinInput.Root otp autoSubmit name="code">
        <PinInput.Label>Code</PinInput.Label>
        <PinInput.HiddenInput />
        <PinInput.Control>
          <PinInput.Input index={0} />
          <PinInput.Input index={1} />
          <PinInput.Input index={2} />
          <PinInput.Input index={3} />
        </PinInput.Control>
      </PinInput.Root>
      <Text textStyle="sm" mt="2">
        {sent() ? "Submitted" : "Type four digits"}
      </Text>
    </form>
  )
}
