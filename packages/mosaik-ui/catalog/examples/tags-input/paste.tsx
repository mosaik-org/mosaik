import { TagsInput } from "@mosaik/mosaik-ui"

// Paste "red, green; blue": each becomes a tag.
export const App = () => (
  <TagsInput.Root addOnPaste delimiter={/[,;]/}>
    <TagsInput.Label>Tags</TagsInput.Label>
    <TagsInput.Control>
      <TagsInput.Items />
      <TagsInput.Input placeholder="Add tag..." />
    </TagsInput.Control>
  </TagsInput.Root>
)
