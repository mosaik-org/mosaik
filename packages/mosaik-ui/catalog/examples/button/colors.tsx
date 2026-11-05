import { Button } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => <Showcase values={COLORS}>{(color) => <Button colorPalette={color}>Button</Button>}</Showcase>
