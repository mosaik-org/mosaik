import { Badge } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => <Showcase values={COLORS}>{(color) => <Badge colorPalette={color}>Badge</Badge>}</Showcase>
