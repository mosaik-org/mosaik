import { Field, Input } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <Field.Root invalid>
      <Field.Label>Email</Field.Label>
      <Input value="not an email" />
      <Field.ErrorText>
        <Field.ErrorIcon />
        Enter an address like me@example.com
      </Field.ErrorText>
    </Field.Root>
  )
}
