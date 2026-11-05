import { Field, Input } from "@mosaik/mosaik-ui"
import { field } from "styled-system/recipes"
import { Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={field.variantMap.orientation} wide>
    {(orientation) => (
      <Field.Root orientation={orientation} maxW="lg">
        <Field.Label>Shop name</Field.Label>
        <Input value="Northwind Coffee" />
        <Field.HelperText>Shown on receipts.</Field.HelperText>
      </Field.Root>
    )}
  </Showcase>
)
