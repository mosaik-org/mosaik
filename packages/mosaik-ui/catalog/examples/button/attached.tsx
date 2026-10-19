import { Button, ButtonGroup, IconButton } from "@mosaik/mosaik-ui"
import { ChevronDownIcon } from "lucide-solid"

export const App = () => {
  return (
    <ButtonGroup variant="outline" attached>
      <Button>Button</Button>
      <IconButton aria-label="More options">
        <ChevronDownIcon />
      </IconButton>
    </ButtonGroup>
  )
}
