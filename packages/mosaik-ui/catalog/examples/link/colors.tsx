import { Link } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={COLORS}>
    {(color) => (
      <Link href="#/link" colorPalette={color}>
        A link
      </Link>
    )}
  </Showcase>
)
