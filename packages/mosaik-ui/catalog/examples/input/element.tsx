import { Input, InputGroup } from "@mosaik/mosaik-ui"
import Euro from "lucide-solid/icons/euro"
import Info from "lucide-solid/icons/info"
import User from "lucide-solid/icons/user"
import { Stack } from "styled-system/jsx"

export const App = () => {
  return (
    <Stack gap="4">
      <InputGroup startElement={<User />}>
        <Input placeholder="Username" />
      </InputGroup>

      <InputGroup endElement={<Euro />}>
        <Input placeholder="0.00" />
      </InputGroup>

      <InputGroup startElement={<Euro />} endElement={<Info />}>
        <Input placeholder="0.00" />
      </InputGroup>
    </Stack>
  )
}
