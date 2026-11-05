import { Button, FileUpload } from "@mosaik/mosaik-ui"
import UploadIcon from "lucide-solid/icons/upload"

export const App = () => {
  return (
    <FileUpload.Root>
      <FileUpload.HiddenInput />
      <FileUpload.Trigger
        asChild={(triggerProps) => (
          <Button variant="outline" size="sm" {...triggerProps()}>
            <UploadIcon /> Upload file
          </Button>
        )}
      />
      <FileUpload.List clearable showSize />
    </FileUpload.Root>
  )
}
