import { Field, TagsInput } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"

export const App = () => {
  const [rejected, setRejected] = createSignal(false)

  return (
    <Field.Root invalid={rejected()}>
      <TagsInput.Root
        validate={(details) => {
          const valid = details.inputValue.includes("@") && !details.value.includes(details.inputValue)
          setRejected(!valid)
          return valid
        }}
      >
        <TagsInput.Label>Invite</TagsInput.Label>
        <TagsInput.Control>
          <TagsInput.Items />
          <TagsInput.Input placeholder="name@example.com" />
        </TagsInput.Control>
      </TagsInput.Root>
      <Field.ErrorText>An e-mail address, not added yet.</Field.ErrorText>
    </Field.Root>
  )
}
