import { Field, Input } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <Field.Root>
      <Field.Label>Email</Field.Label>
      <Input placeholder="Enter your email" />
    </Field.Root>
  )
}
