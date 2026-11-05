import { IconButton } from "@mosaik/mosaik-ui"
import SendIcon from "lucide-solid/icons/send"

export const App = () => {
  return (
    <IconButton borderRadius="full" aria-label="Send message">
      <SendIcon />
    </IconButton>
  )
}
