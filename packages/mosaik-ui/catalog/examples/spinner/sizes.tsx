import { Spinner } from "@mosaik/mosaik-ui"
import { spinner } from "styled-system/recipes"
import { bySize, Showcase } from "../../showcase"

/** `inherit` takes the size of the text around it. */
export const App = () => (
  <Showcase values={bySize(spinner.variantMap.size)}>{(size) => <Spinner size={size} />}</Showcase>
)
