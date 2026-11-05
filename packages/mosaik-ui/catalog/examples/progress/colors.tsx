import { Progress } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={COLORS} wide>
    {(color) => (
      <Progress.Root defaultValue={42} colorPalette={color} aria-label={`Progress in ${color}`}>
        <Progress.Track>
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
    )}
  </Showcase>
)
