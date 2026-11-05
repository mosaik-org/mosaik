import { Field, Input } from "@mosaik/mosaik-ui"
import { Stack } from "styled-system/jsx"

export const App = () => {
  return (
    <Stack gap="4" maxW="lg">
      <Field.Root orientation="horizontal">
        <Field.Label>Shop name</Field.Label>
        <Input value="Northwind Coffee" />
        <Field.HelperText>Shown on receipts.</Field.HelperText>
      </Field.Root>
      <Field.Root orientation="horizontal" invalid>
        <Field.Label>Website</Field.Label>
        <Input value="northwind" />
        <Field.ErrorText>
          <Field.ErrorIcon />
          Enter a full address
        </Field.ErrorText>
      </Field.Root>
    </Stack>
  )
}
