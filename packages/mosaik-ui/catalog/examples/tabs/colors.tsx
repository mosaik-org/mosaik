import { Tabs } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={COLORS}>
    {(color) => (
      <Tabs.Root defaultValue="one" colorPalette={color}>
        <Tabs.List aria-label={`Tabs in ${color}`}>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one" />
        <Tabs.Content value="two" />
      </Tabs.Root>
    )}
  </Showcase>
)
