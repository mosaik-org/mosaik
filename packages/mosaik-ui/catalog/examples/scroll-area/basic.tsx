import { ScrollArea } from "@mosaik/mosaik-ui"
import { filler } from "../../filler"

export const App = () => {
  return (
    <ScrollArea.Root height="36">
      <ScrollArea.Viewport>
        <ScrollArea.Content spaceY="3" textStyle="sm" innerHTML={filler(10)} />
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar />
      <ScrollArea.Corner />
    </ScrollArea.Root>
  )
}
