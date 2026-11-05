import { Avatar } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={COLORS}>
    {(color) => (
      <Avatar.Root colorPalette={color}>
        <Avatar.Fallback name="Ada Lovelace" />
      </Avatar.Root>
    )}
  </Showcase>
)
