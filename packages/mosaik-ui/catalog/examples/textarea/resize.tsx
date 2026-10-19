import { Textarea } from "@mosaik/mosaik-ui"
import { Stack } from "styled-system/jsx"

export const App = () => {
  return (
    <Stack gap="4" maxW="50%">
      <Textarea resize="none" placeholder="none" />
      <Textarea resize="vertical" placeholder="vertical" />
      <Textarea resize="horizontal" placeholder="horizontal" />
      <Textarea resize="both" placeholder="both" />
    </Stack>
  )
}
