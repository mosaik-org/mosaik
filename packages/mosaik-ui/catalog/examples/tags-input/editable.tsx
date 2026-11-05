import { TagsInput } from "@mosaik/mosaik-ui"

// Double-click a tag, or move to it with the arrow keys and press Enter, to change it.
export const App = () => (
  <TagsInput.Root editable defaultValue={["React", "Solid"]}>
    <TagsInput.Label>Tags</TagsInput.Label>
    <TagsInput.Control>
      <TagsInput.Items />
      <TagsInput.Input placeholder="Add tag..." />
    </TagsInput.Control>
  </TagsInput.Root>
)
