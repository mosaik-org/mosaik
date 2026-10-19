import { Link } from "@mosaik/mosaik-ui"
import { Stack } from "styled-system/jsx"

export const App = () => {
  return (
    <Stack gap="4" align="start">
      <Link href="https://park-ui.com" variant="underline">
        Visit Mosaik UI
      </Link>
      <Link href="https://park-ui.com" variant="plain">
        Visit Mosaik UI
      </Link>
    </Stack>
  )
}
