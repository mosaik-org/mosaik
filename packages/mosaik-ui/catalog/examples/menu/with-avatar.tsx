import { Avatar, Menu } from "@mosaik/mosaik-ui"
import LogOutIcon from "lucide-solid/icons/log-out"
import Settings2Icon from "lucide-solid/icons/settings-2"
import UserIcon from "lucide-solid/icons/user"

export const App = () => {
  return (
    <Menu.Root positioning={{ placement: "right-end" }}>
      <Menu.Trigger rounded="full">
        <Avatar.Root size="lg">
          <Avatar.Image src="https://avatars.githubusercontent.com/u/1846056?v=4" />
          <Avatar.Fallback name="Christian Busch" />
        </Avatar.Root>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content>
          <Menu.Item value="account">
            <UserIcon />
            Account
          </Menu.Item>
          <Menu.Item value="settings">
            <Settings2Icon />
            Settings
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item value="logout">
            <LogOutIcon />
            Logout
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  )
}
