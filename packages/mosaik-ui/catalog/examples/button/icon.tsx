import { Button } from "@mosaik/mosaik-ui"
import PhoneIcon from "lucide-solid/icons/phone"
import SendIcon from "lucide-solid/icons/send"
import { Wrap } from "styled-system/jsx"

export const App = () => {
  return (
    <Wrap gap="4">
      <Button>
        <SendIcon />
        Send
      </Button>
      <Button variant="outline">
        Call us <PhoneIcon />
      </Button>
    </Wrap>
  )
}
