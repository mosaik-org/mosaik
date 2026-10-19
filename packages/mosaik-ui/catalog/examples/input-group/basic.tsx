import { Input, InputGroup } from "@mosaik/mosaik-ui"
import { EuroIcon } from "lucide-solid"

export const App = () => {
  return (
    <InputGroup startElement={<EuroIcon />}>
      <Input placeholder="0.00" />
    </InputGroup>
  )
}
