import { Input, InputGroup } from "@mosaik/mosaik-ui"
import { Euro, Info, User } from "lucide-solid"
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
