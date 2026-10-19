import { useCheckboxGroup } from "@ark-ui/solid/checkbox"
import { Button, Menu } from "@mosaik/mosaik-ui"
import { For } from "solid-js"

export const App = () => {
  const items = [
    { title: "Enable Notifications", value: "notifications" },
    { title: "Dark Mode", value: "dark-mode" },
    { title: "Show Tooltips", value: "tooltips" },
  ]

  const group = useCheckboxGroup({ defaultValue: ["notifications"] })

  return (
    <Menu.Root>
      <Menu.Trigger
        asChild={(triggerProps) => (
          <Button variant="surface" {...triggerProps()}>
            Settings
            <Menu.Indicator />
          </Button>
        )}
      />
      <Menu.Positioner>
        <Menu.Content>
          <For each={items}>
            {({ title, value }) => (
              <Menu.CheckboxItem
                value={value}
                checked={group().isChecked(value)}
                onCheckedChange={() => group().toggleValue(value)}
              >
                {title}
                <Menu.ItemIndicator />
              </Menu.CheckboxItem>
            )}
          </For>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  )
}
