import { Group, Input, InputAddon } from "@mosaik/mosaik-ui"
import AtSign from "lucide-solid/icons/at-sign"
import Euro from "lucide-solid/icons/euro"
import { Stack } from "styled-system/jsx"

export const App = () => {
  return (
    <Stack gap="4">
      <Group attached>
        <InputAddon>https://</InputAddon>
        <Input placeholder="yoursite.com" />
      </Group>
      <Group attached>
        <InputAddon>
          <AtSign />
        </InputAddon>
        <Input placeholder="Username" />
      </Group>
      <Group attached>
        <InputAddon>
          <Euro />
        </InputAddon>
        <Input placeholder="0.00" />
        <InputAddon>EUR</InputAddon>
      </Group>
    </Stack>
  )
}
