import { Avatar, Tooltip } from "@mosaik/mosaik-ui"
import { createUniqueId } from "solid-js"

export const App = () => {
  const id = createUniqueId()

  return (
    <Tooltip ids={{ trigger: id }} content="Christian Busch is online">
      <Avatar.Root ids={{ root: id }} size="lg">
        <Avatar.Image src="https://shorturl.at/gaV8r" />
        <Avatar.Fallback name="Christian Busch" />
      </Avatar.Root>
    </Tooltip>
  )
}
