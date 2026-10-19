import { IconButton, Input, InputGroup } from "@mosaik/mosaik-ui"
import { SearchIcon } from "lucide-solid"

export const App = () => {
  return (
    <InputGroup
      endElement={
        <IconButton variant="surface" size="xs" colorPalette="gray" aria-label="Search">
          <SearchIcon />
        </IconButton>
      }
    >
      <Input placeholder="Search" />
    </InputGroup>
  )
}
