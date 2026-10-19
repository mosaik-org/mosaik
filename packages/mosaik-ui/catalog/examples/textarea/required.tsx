import { Field, Textarea } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <Field.Root required>
      <Field.Label>
        Comment <Field.RequiredIndicator />
      </Field.Label>
      <Textarea placeholder="Enter your comment" />
    </Field.Root>
  )
}
