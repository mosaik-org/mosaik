import { Button } from "@mosaik/mosaik-ui"
import { PhoneIcon, SendIcon } from "lucide-solid"
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
