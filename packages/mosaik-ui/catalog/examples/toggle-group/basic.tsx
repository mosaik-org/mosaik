import { ButtonGroup, IconButton, ToggleGroup } from "@mosaik/mosaik-ui"
import AlignCenterIcon from "lucide-solid/icons/text-align-center"
import AlignRightIcon from "lucide-solid/icons/text-align-end"
import AlignJustifyIcon from "lucide-solid/icons/text-align-justify"
import AlignLeftIcon from "lucide-solid/icons/text-align-start"

export const App = () => {
  return (
    <ToggleGroup.Root
      defaultValue={["left"]}
      asChild={(props) => (
        <ButtonGroup variant="outline" attached {...props()}>
          <ToggleGroup.Item
            value="left"
            asChild={(itemProps) => (
              <IconButton aria-label="Align Left" {...itemProps()}>
                <AlignLeftIcon />
              </IconButton>
            )}
          />
          <ToggleGroup.Item
            value="center"
            asChild={(itemProps) => (
              <IconButton aria-label="Align Center" {...itemProps()}>
                <AlignCenterIcon />
              </IconButton>
            )}
          />
          <ToggleGroup.Item
            value="right"
            asChild={(itemProps) => (
              <IconButton aria-label="Align Right" {...itemProps()}>
                <AlignRightIcon />
              </IconButton>
            )}
          />
          <ToggleGroup.Item
            value="justify"
            asChild={(itemProps) => (
              <IconButton aria-label="Align Justify" {...itemProps()}>
                <AlignJustifyIcon />
              </IconButton>
            )}
          />
        </ButtonGroup>
      )}
    />
  )
}
