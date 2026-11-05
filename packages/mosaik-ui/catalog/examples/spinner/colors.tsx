import { Spinner } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={COLORS}>{(color) => <Spinner color="colorPalette.9" colorPalette={color} />}</Showcase>
)
