import { CloseButton, Input, InputGroup } from "@mosaik/mosaik-ui"
import SearchIcon from "lucide-solid/icons/search"
import { createSignal, Show } from "solid-js"

export const App = () => {
  const [value, setValue] = createSignal("Orders")
  return (
    <InputGroup
      maxW="xs"
      startElement={<SearchIcon />}
      endElement={
        <Show when={value()}>
          <CloseButton size="xs" aria-label="Clear the search" onClick={() => setValue("")} />
        </Show>
      }
    >
      <Input
        placeholder="Search"
        aria-label="Search"
        value={value()}
        onInput={(event) => setValue(event.currentTarget.value)}
      />
    </InputGroup>
  )
}
