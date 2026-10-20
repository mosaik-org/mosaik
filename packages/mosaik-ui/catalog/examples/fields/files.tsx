import { FileUploadField } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const [files, setFiles] = createSignal<ReadonlyArray<File>>([])
  return (
    <Stack gap="6" maxW="md">
      <FileUploadField
        label="Invoice"
        accept={["application/pdf", "image/*"]}
        maxFileSize={10 * 1024 * 1024}
        helperText="A PDF or an image, up to 10 MB."
        files={files()}
        onFilesChange={setFiles}
      />
      <FileUploadField
        label="Photos"
        accept="image/*"
        maxFiles={5}
        placeholder="Drop up to five photos here, or click to choose them"
      />
    </Stack>
  )
}
