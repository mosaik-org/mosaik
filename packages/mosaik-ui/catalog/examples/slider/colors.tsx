import { Slider } from "@mosaik/mosaik-ui"
import { COLORS, Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={COLORS} wide>
    {(color) => (
      <Slider.Root defaultValue={[60]} colorPalette={color} maxW="sm" aria-label={[`Slider in ${color}`]}>
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumbs />
        </Slider.Control>
      </Slider.Root>
    )}
  </Showcase>
)
