import { Breadcrumb } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const sizes = ["xs", "sm", "md", "lg"] as const
  return (
    <Stack gap="4">
      <For each={sizes}>
        {(size) => (
          <Breadcrumb.Root size={size} aria-label={`Breadcrumb (${size})`}>
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
