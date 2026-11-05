import { Button, Menu } from "@mosaik/mosaik-ui"
import { For } from "solid-js"

const links = [
  { label: "Documentation", href: "https://solidjs.com/docs" },
  { label: "Tutorial", href: "https://solidjs.com/tutorial" },
  { label: "Playground", href: "https://playground.solidjs.com" },
]

export const App = () => (
  <Menu.Root>
    <Menu.Trigger
      asChild={(triggerProps) => (
        <Button variant="outline" {...triggerProps()}>
          Help
          <Menu.Indicator />
        </Button>
      )}
    />
    <Menu.Positioner>
      <Menu.Content>
        <For each={links}>
          {(link) => (
            <Menu.Item
              value={link.href}
              asChild={(itemProps) => (
                <a href={link.href} target="_blank" rel="noreferrer" {...itemProps()}>
                  {link.label}
                </a>
              )}
            />
          )}
        </For>
      </Menu.Content>
    </Menu.Positioner>
  </Menu.Root>
)
