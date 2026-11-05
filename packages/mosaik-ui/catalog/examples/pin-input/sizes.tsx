import { PinInput } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"
import { pinInput } from "styled-system/recipes"
import { bySize } from "../../showcase"

export const App = () => {
  const sizes = bySize(pinInput.variantMap.size)
  return (
    <Stack gap="4">
      <For each={sizes}>
        {(size) => (
          <PinInput.Root size={size}>
            <PinInput.HiddenInput />
            <PinInput.Control>
              <PinInput.Input index={0} />
              <PinInput.Input index={1} />
              <PinInput.Input index={2} />
              <PinInput.Input index={3} />
            </PinInput.Control>
          </PinInput.Root>
        )}
      </For>
    </Stack>
  )
}
