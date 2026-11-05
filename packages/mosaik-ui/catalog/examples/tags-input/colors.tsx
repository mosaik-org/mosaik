import { TagsInput } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={COLORS}>
    {(color) => (
      <TagsInput.Root defaultValue={["Tag"]} colorPalette={color}>
        <TagsInput.Control>
          <TagsInput.Items />
          <TagsInput.Input placeholder="Add" aria-label={`Tags in ${color}`} />
        </TagsInput.Control>
      </TagsInput.Root>
    )}
  </Showcase>
)
