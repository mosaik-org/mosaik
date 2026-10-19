import { Group, Input, InputAddon } from "@mosaik/mosaik-ui"
import { EuroIcon } from "lucide-solid"

export const App = () => {
  return (
    <Group attached width="full">
      <InputAddon>
        <EuroIcon />
      </InputAddon>
      <Input placeholder="0.00" />
      <InputAddon>EUR</InputAddon>
    </Group>
  )
}
