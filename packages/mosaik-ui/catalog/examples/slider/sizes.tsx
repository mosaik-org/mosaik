import { Slider } from "@mosaik/mosaik-ui"
import { slider } from "styled-system/recipes"
import { bySize, Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={bySize(slider.variantMap.size)} wide>
    {(size) => (
      <Slider.Root defaultValue={[40]} size={size} maxW="sm" aria-label={[`Slider, ${size}`]}>
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
