import { DisplayValue } from "@mosaik/mosaik-ui"
import { Stack } from "styled-system/jsx"

export const App = () => {
  return (
    <Stack gap="0">
      <DisplayValue value={null} />
      <DisplayValue value={undefined} />
      <DisplayValue value="" />
      <DisplayValue value={[]} />
    </Stack>
  )
}
