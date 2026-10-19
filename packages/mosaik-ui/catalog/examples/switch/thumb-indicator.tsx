import { Switch } from "@mosaik/mosaik-ui"
import { CheckIcon, XIcon } from "lucide-solid"

export const App = () => {
  return (
    <Switch.Root>
      <Switch.HiddenInput />
      <Switch.Control>
        <Switch.Thumb>
          <Switch.ThumbIndicator fallback={<XIcon />}>
            <CheckIcon />
          </Switch.ThumbIndicator>
        </Switch.Thumb>
      </Switch.Control>
      <Switch.Label>Label</Switch.Label>
    </Switch.Root>
  )
}
