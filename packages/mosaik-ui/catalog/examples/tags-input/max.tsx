import { TagsInput } from "@mosaik/mosaik-ui"

// No more than three: past that, typing adds nothing.
export const App = () => (
  <TagsInput.Root max={3} defaultValue={["React", "Solid"]}>
    <TagsInput.Label>Tags</TagsInput.Label>
    <TagsInput.Control>
      <TagsInput.Items />
      <TagsInput.Input placeholder="Add tag..." />
    </TagsInput.Control>
  </TagsInput.Root>
)
