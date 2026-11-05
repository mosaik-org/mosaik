import { ButtonGroup, Editable, IconButton } from "@mosaik/mosaik-ui"
import CheckIcon from "lucide-solid/icons/check"
import EditIcon from "lucide-solid/icons/square-pen"
import XIcon from "lucide-solid/icons/x"

export const App = () => {
  return (
    <Editable.Root defaultValue="Click to edit" size="sm">
      <Editable.Preview />
      <Editable.Input />
      <Editable.Control>
        <Editable.EditTrigger
          asChild={(triggerProps) => (
            <IconButton variant="plain" size="sm" colorPalette="gray" {...triggerProps()}>
              <EditIcon />
            </IconButton>
          )}
        />
        <ButtonGroup variant="outline" size="sm">
          <Editable.CancelTrigger
            asChild={(triggerProps) => (
              <IconButton colorPalette="gray" {...triggerProps()}>
                <XIcon />
              </IconButton>
            )}
          />
          <Editable.SubmitTrigger
            asChild={(triggerProps) => (
              <IconButton colorPalette="gray" {...triggerProps()}>
                <CheckIcon />
              </IconButton>
            )}
          />
        </ButtonGroup>
      </Editable.Control>
    </Editable.Root>
  )
}
