import { Tabs } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"
import { tabs } from "styled-system/recipes"
import { bySize } from "../../showcase"

export const App = () => {
  const sizes = bySize(tabs.variantMap.size)

  return (
    <Stack gap="4">
      <For each={sizes}>
        {(size) => (
          <Tabs.Root defaultValue="react" size={size}>
            <Tabs.List>
              <Tabs.Trigger value="react">React</Tabs.Trigger>
              <Tabs.Trigger value="solid">Solid</Tabs.Trigger>
              <Tabs.Trigger value="svelte">Svelte</Tabs.Trigger>
              <Tabs.Trigger value="vue">Vue</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="react" />
            <Tabs.Content value="solid" />
            <Tabs.Content value="svelte" />
            <Tabs.Content value="vue" />
          </Tabs.Root>
        )}
      </For>
    </Stack>
  )
}
