import { FileUpload } from "@mosaik/mosaik-ui"
import { fileUpload } from "styled-system/recipes"
import { bySize, Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={bySize(fileUpload.variantMap.size)} wide>
    {(size) => (
      <FileUpload.Root size={size}>
        <FileUpload.HiddenInput />
        <FileUpload.Dropzone>Drop a file here, or click to choose one ({size})</FileUpload.Dropzone>
      </FileUpload.Root>
    )}
  </Showcase>
)
