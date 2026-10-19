import { Breadcrumb } from "@mosaik/mosaik-ui"
import { ComponentIcon, FileIcon } from "lucide-solid"

export const App = () => {
  return (
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link href="#">
            <FileIcon />
            Docs
          </Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Link href="#">
            <ComponentIcon />
            Components
          </Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>Breadcrumbs</Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
  )
}
