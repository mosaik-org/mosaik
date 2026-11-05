import { Tabs } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const variants = ["line", "subtle", "enclosed"] as const

  return (
    <Stack gap="4">
      <For each={variants}>
        {(variant) => (
          <Tabs.Root defaultValue="react" variant={variant}>
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
