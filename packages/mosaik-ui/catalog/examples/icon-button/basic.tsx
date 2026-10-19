import { IconButton } from "@mosaik/mosaik-ui"
import { SendIcon } from "lucide-solid"

export const App = () => {
  return (
    <IconButton aria-label="Send message">
      <SendIcon />
    </IconButton>
  )
}
