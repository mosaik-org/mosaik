import { Button, Menu } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Wrap } from "styled-system/jsx"
import { menu } from "styled-system/recipes"
import { bySize } from "../../showcase"

export const App = () => {
  const sizes = bySize(menu.variantMap.size)

  return (
    <Wrap gap="4">
      <For each={sizes}>
        {(size) => (
          <Menu.Root size={size}>
            <Menu.Trigger
              asChild={(triggerProps) => (
                <Button variant="outline" size={size} {...triggerProps()}>
                  File
                  <Menu.Indicator />
                </Button>
              )}
            />
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item value="new-file">New File</Menu.Item>
                <Menu.Item value="open-file">Open File</Menu.Item>
                <Menu.Separator />
                <Menu.Item value="save">Save</Menu.Item>
                <Menu.Item value="save-as">Save As</Menu.Item>
                <Menu.Item value="recent-files">Recent Files</Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
        )}
      </For>
    </Wrap>
  )
}
