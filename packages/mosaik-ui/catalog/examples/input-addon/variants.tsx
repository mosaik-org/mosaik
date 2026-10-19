import { Group, Input, InputAddon } from "@mosaik/mosaik-ui"
import { EuroIcon } from "lucide-solid"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const variants = ["outline", "subtle", "surface"] as const
  return (
    <Stack gap="4">
      <For each={variants}>
        {(variant) => (
          <Group attached>
            <InputAddon variant={variant}>
              <EuroIcon />
            </InputAddon>
            <Input placeholder="0.00" variant={variant} />
            <InputAddon variant={variant}>EUR</InputAddon>
          </Group>
        )}
      </For>
    </Stack>
  )
}
