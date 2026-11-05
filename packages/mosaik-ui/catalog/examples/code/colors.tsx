import { Code } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => <Showcase values={COLORS}>{(color) => <Code colorPalette={color}>const a = 1</Code>}</Showcase>
