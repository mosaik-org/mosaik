import { Accordion } from "@mosaik/mosaik-ui"
import { accordion } from "styled-system/recipes"
import { Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={accordion.variantMap.variant} wide>
    {(variant) => (
      <Accordion.Root defaultValue={["one"]} variant={variant}>
        <Accordion.Item value="one">
          <Accordion.ItemTrigger>
            What is {variant}?
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Accordion.ItemBody>A list of questions, one open at a time.</Accordion.ItemBody>
          </Accordion.ItemContent>
        </Accordion.Item>
      </Accordion.Root>
    )}
  </Showcase>
)
