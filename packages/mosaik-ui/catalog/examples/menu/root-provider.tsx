import { Button, Menu } from "@mosaik/mosaik-ui"
import { Wrap } from "styled-system/jsx"

export const App = () => {
  const menu = Menu.useMenu()

  return (
    <Wrap gap="4">
      <Button variant="outline" onClick={() => menu.api().setOpen(true)}>
        Open from outside
      </Button>
      <Menu.RootProvider value={menu}>
        <Menu.Trigger
          asChild={(triggerProps) => (
            <Button variant="outline" {...triggerProps()}>
              File
              <Menu.Indicator />
            </Button>
          )}
        />
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="new">New</Menu.Item>
            <Menu.Item value="open">Open</Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.RootProvider>
    </Wrap>
  )
}
