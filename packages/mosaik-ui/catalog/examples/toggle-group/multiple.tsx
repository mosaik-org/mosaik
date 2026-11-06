import { ButtonGroup, IconButton, ToggleGroup } from "@mosaik/mosaik-ui"
import ItalicIcon from "lucide-solid/icons/italic"
import BoldIcon from "lucide-solid/icons/letter-b"
import UnderlineIcon from "lucide-solid/icons/underline"

export const App = () => {
  return (
    <ToggleGroup.Root
      defaultValue={["bold", "underline"]}
      multiple
      asChild={(props) => (
        <ButtonGroup variant="outline" attached {...props()}>
          <ToggleGroup.Item
            value="bold"
            asChild={(itemProps) => (
              <IconButton aria-label="Toggle Bold" {...itemProps()}>
                <BoldIcon />
              </IconButton>
            )}
          />
          <ToggleGroup.Item
            value="italic"
            asChild={(itemProps) => (
              <IconButton aria-label="Toggle Italic" {...itemProps()}>
                <ItalicIcon />
              </IconButton>
            )}
          />
          <ToggleGroup.Item
            value="underline"
            asChild={(itemProps) => (
              <IconButton aria-label="Toggle Underline" {...itemProps()}>
                <UnderlineIcon />
              </IconButton>
            )}
          />
        </ButtonGroup>
      )}
    />
  )
}
