import { Tabs } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <Tabs.Root defaultValue="react" orientation="vertical" variant="line">
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
  )
}
