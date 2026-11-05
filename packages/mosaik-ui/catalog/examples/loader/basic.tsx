import { Loader } from "@mosaik/mosaik-ui"
import { Stack } from "styled-system/jsx"

export const App = () => (
  <Stack gap="4" alignItems="flex-start">
    <span>
      <Loader text="Saving…" />
    </span>
    <span>
      <Loader text="Saving…" spinnerPlacement="end" />
    </span>
  </Stack>
)
