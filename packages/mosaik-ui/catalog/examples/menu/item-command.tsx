import { Button, Menu } from "@mosaik/mosaik-ui"
import Copy from "lucide-solid/icons/copy"
import Scissors from "lucide-solid/icons/scissors"
import Trash from "lucide-solid/icons/trash"

export const App = () => (
  <Menu.Root>
    <Menu.Trigger
      asChild={(triggerProps) => (
        <Button variant="outline" {...triggerProps()}>
          Edit
          <Menu.Indicator />
        </Button>
      )}
    />
    <Menu.Positioner>
      <Menu.Content>
        <Menu.Item value="cut">
          <Scissors />
          Cut
          <Menu.ItemCommand>Ctrl X</Menu.ItemCommand>
        </Menu.Item>
        <Menu.Item value="copy">
          <Copy />
          Copy
          <Menu.ItemCommand>Ctrl C</Menu.ItemCommand>
        </Menu.Item>
        <Menu.Separator />
        <Menu.Item value="delete" data-danger="">
          <Trash />
          Delete
          <Menu.ItemCommand>Del</Menu.ItemCommand>
        </Menu.Item>
      </Menu.Content>
    </Menu.Positioner>
  </Menu.Root>
)
