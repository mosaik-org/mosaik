import { Kbd } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => <Showcase values={COLORS}>{(color) => <Kbd colorPalette={color}>Ctrl</Kbd>}</Showcase>
