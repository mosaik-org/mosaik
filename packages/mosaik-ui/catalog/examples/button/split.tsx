import { Button, Group, IconButton, Menu } from "@mosaik/mosaik-ui"
import ChevronDownIcon from "lucide-solid/icons/chevron-down"
import { Portal } from "solid-js/web"

/** A button and a menu of what else it can do, attached. */
export const App = () => (
  <Group attached>
    <Button variant="outline">Save</Button>
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger
        asChild={(trigger) => (
          <IconButton {...trigger()} variant="outline" aria-label="More ways to save">
            <ChevronDownIcon />
          </IconButton>
        )}
      />
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="draft">Save as a draft</Menu.Item>
            <Menu.Item value="copy">Save a copy</Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  </Group>
)
