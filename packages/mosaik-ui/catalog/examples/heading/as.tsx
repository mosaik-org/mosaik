import { Heading } from "@mosaik/mosaik-ui"
import { Stack } from "styled-system/jsx"

export const App = () => {
  return (
    <Stack>
      <Heading as="h1">Level 1</Heading>
      <Heading as="h2">Level 2</Heading>
      <Heading as="h3">Level 3</Heading>
    </Stack>
  )
}
