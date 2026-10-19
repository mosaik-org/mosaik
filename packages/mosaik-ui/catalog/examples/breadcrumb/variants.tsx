import { Breadcrumb } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const variants = ["plain", "underline"] as const
  return (
    <Stack gap="4">
      <For each={variants}>
        {(variant) => (
          <Breadcrumb.Root variant={variant} aria-label={`Breadcrumb (${variant})`}>
            <Breadcrumb.List>
              <Breadcrumb.Item>
                <Breadcrumb.Link href="#">Docs</Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Separator />
              <Breadcrumb.Item>
                <Breadcrumb.Link href="#">Components</Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Separator />
              <Breadcrumb.Item>Breadcrumbs</Breadcrumb.Item>
            </Breadcrumb.List>
          </Breadcrumb.Root>
        )}
      </For>
    </Stack>
  )
}
