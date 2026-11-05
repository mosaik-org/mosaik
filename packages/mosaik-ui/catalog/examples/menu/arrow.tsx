import { Button, Menu } from "@mosaik/mosaik-ui"

export const App = () => (
  <Menu.Root>
    <Menu.Trigger
      asChild={(triggerProps) => (
        <Button variant="outline" {...triggerProps()}>
          File
          <Menu.Indicator />
        </Button>
      )}
    />
    <Menu.Positioner>
      {/* Beside the content, not in it: a long menu scrolls, which would clip the arrow. */}
      <Menu.Arrow />
      <Menu.Content>
        <Menu.Item value="new">New</Menu.Item>
        <Menu.Item value="open">Open</Menu.Item>
        <Menu.Item value="save">Save</Menu.Item>
      </Menu.Content>
    </Menu.Positioner>
  </Menu.Root>
)
