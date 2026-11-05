import { RatingGroup } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={COLORS}>
    {(color) => (
      <RatingGroup.Root count={5} defaultValue={3} colorPalette={color} aria-label={`Rating in ${color}`}>
        <RatingGroup.HiddenInput />
        <RatingGroup.Control />
      </RatingGroup.Root>
    )}
  </Showcase>
)
