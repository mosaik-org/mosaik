import { Button, Steps } from "@mosaik/mosaik-ui"
import CheckIcon from "lucide-solid/icons/check"
import { For } from "solid-js"
import { HStack } from "styled-system/jsx"

const items = [
  { title: "Account", description: "Name and email" },
  { title: "Workspace", description: "Team and plan" },
  { title: "Invite", description: "Your colleagues" },
]

export const App = () => (
  <Steps.Root count={items.length} defaultStep={1}>
    <Steps.List>
      <For each={items}>
        {(item, index) => (
          <Steps.Item index={index()}>
            <Steps.Trigger>
              <Steps.Indicator>
                <Steps.ItemContext>{(step) => (step().completed ? <CheckIcon /> : index() + 1)}</Steps.ItemContext>
              </Steps.Indicator>
              <div>
                <Steps.Title>{item.title}</Steps.Title>
                <Steps.Description>{item.description}</Steps.Description>
              </div>
            </Steps.Trigger>
            <Steps.Separator />
          </Steps.Item>
        )}
      </For>
    </Steps.List>
    <For each={items}>
      {(item, index) => (
        <Steps.Content index={index()}>
          {item.title}: {item.description}
        </Steps.Content>
      )}
    </For>
    <Steps.CompletedContent>All done.</Steps.CompletedContent>
    <HStack>
      <Steps.PrevTrigger
        asChild={(props) => (
          <Button variant="outline" {...props()}>
            Back
          </Button>
        )}
      />
      <Steps.NextTrigger asChild={(props) => <Button {...props()}>Next</Button>} />
    </HStack>
  </Steps.Root>
)
