import { Button, FileUpload } from "@mosaik/mosaik-ui"
import { FolderUpIcon } from "lucide-solid"

export const App = () => {
  return (
    <FileUpload.Root directory>
      <FileUpload.HiddenInput />
      <FileUpload.Trigger
        asChild={(triggerProps) => (
          <Button variant="outline" size="sm" {...triggerProps()}>
            <FolderUpIcon /> Upload directory
          </Button>
        )}
      />
      <FileUpload.List />
    </FileUpload.Root>
  )
}
