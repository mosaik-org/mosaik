import { Avatar } from "@mosaik/mosaik-ui"
import { For } from "solid-js"
import { Wrap } from "styled-system/jsx"

export const App = () => {
  const sizes = ["xs", "sm", "md", "lg", "xl", "2xl"] as const

  return (
    <Wrap gap="4">
      <For each={sizes}>
        {(size) => (
          <Avatar.Root size={size}>
            <Avatar.Fallback name="Christian Busch" />
            <Avatar.Image src="https://avatars.githubusercontent.com/u/1846056?v=4" />
          </Avatar.Root>
        )}
      </For>
    </Wrap>
  )
}
