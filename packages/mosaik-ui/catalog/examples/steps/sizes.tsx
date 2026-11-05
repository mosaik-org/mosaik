import { Steps } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { steps } from "styled-system/recipes"
import { bySize, Showcase } from "../../showcase"

const items = ["Account", "Workspace", "Invite"]

export const App = () => (
  <Showcase values={bySize(steps.variantMap.size)} wide>
    {(size) => (
      <Steps.Root count={items.length} defaultStep={1} size={size}>
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
    )}
  </Showcase>
)
