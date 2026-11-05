import { Slider } from "@mosaik/mosaik-ui"
import { slider } from "styled-system/recipes"
import { Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={slider.variantMap.orientation}>
    {(orientation) => (
      <Slider.Root defaultValue={[60]} orientation={orientation} width="40" height="32" aria-label={[orientation]}>
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
