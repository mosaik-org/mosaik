import { Button, FileUpload } from "@mosaik/mosaik-ui"
import FileUpIcon from "lucide-solid/icons/file-up"

export const App = () => {
  return (
    <FileUpload.Root maxFiles={3}>
      <FileUpload.HiddenInput />
      <FileUpload.Trigger
        asChild={(triggerProps) => (
          <Button variant="outline" size="sm" {...triggerProps()}>
            <FileUpIcon /> Upload file
          </Button>
        )}
      />
      <FileUpload.List clearable showSize />
    </FileUpload.Root>
  )
}
