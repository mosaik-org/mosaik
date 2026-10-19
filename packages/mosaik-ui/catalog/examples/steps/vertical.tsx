import { Steps } from "@mosaik/mosaik-ui"
import { For } from "solid-js"

const items = ["Ordered", "Packed", "Shipped", "Delivered"]

export const App = () => (
  <Steps.Root orientation="vertical" count={items.length} defaultStep={2} size="sm">
    <Steps.List>
      <For each={items}>
        {(item, index) => (
          <Steps.Item index={index()}>
            <Steps.Trigger>
              <Steps.Indicator>{index() + 1}</Steps.Indicator>
              <Steps.Title>{item}</Steps.Title>
            </Steps.Trigger>
            <Steps.Separator />
          </Steps.Item>
        )}
      </For>
    </Steps.List>
    <For each={items}>{(item, index) => <Steps.Content index={index()}>{item}</Steps.Content>}</For>
  </Steps.Root>
)
