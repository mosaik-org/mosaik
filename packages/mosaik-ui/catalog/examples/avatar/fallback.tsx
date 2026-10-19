import { Avatar } from "@mosaik/mosaik-ui"
import { Wrap } from "styled-system/jsx"

export const App = () => {
  return (
    <Wrap gap="4">
      <Avatar.Root size="lg">
        <Avatar.Fallback name="Christian Busch" />
        <Avatar.Image src="https://" />
      </Avatar.Root>
      <Avatar.Root size="lg">
        <Avatar.Fallback />
        <Avatar.Image src="https://" />
      </Avatar.Root>
    </Wrap>
  )
}
