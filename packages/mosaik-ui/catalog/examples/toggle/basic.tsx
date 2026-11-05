import { Toggle } from "@mosaik/mosaik-ui"
import BoldIcon from "lucide-solid/icons/bold"
import ItalicIcon from "lucide-solid/icons/italic"
import { HStack } from "styled-system/jsx"

export const App = () => (
  <HStack>
    <Toggle aria-label="Bold" px="0">
      <BoldIcon />
    </Toggle>
    <Toggle aria-label="Italic" px="0" defaultPressed>
      <ItalicIcon />
    </Toggle>
    <Toggle variant="subtle">Show archived</Toggle>
  </HStack>
)
