import { Field, TagsInput } from "@mosaik/mosaik-ui"

export const App = () => (
  <Field.Root>
    <TagsInput.Root defaultValue={["Design"]}>
      {/* Its own label, as `Field.Label` does not reach the input inside. */}
      <TagsInput.Label>Topics</TagsInput.Label>
      <TagsInput.Control>
        <TagsInput.Items />
        <TagsInput.Input placeholder="Add topic..." />
      </TagsInput.Control>
    </TagsInput.Root>
    <Field.HelperText>Press Enter after each one.</Field.HelperText>
  </Field.Root>
)
