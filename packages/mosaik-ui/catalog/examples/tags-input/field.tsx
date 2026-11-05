import { Field, TagsInput } from "@mosaik/mosaik-ui"

export const App = () => (
  <Field.Root>
    <Field.Label>Topics</Field.Label>
    <TagsInput.Root defaultValue={["Design"]}>
      <TagsInput.Control>
        <TagsInput.Items />
        <TagsInput.Input placeholder="Add topic..." />
      </TagsInput.Control>
    </TagsInput.Root>
    <Field.HelperText>Press Enter after each one.</Field.HelperText>
  </Field.Root>
)
