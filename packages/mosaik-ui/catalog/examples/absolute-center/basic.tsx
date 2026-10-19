import { AbsoluteCenter } from "@mosaik/mosaik-ui"
import { Box } from "styled-system/jsx"

export const App = () => {
  return (
    <Box position="relative" height="40">
      <AbsoluteCenter>
        <Box bg="gray.surface.bg" p="4" borderRadius="l2" boxShadow="md">
          Centered Content
        </Box>
      </AbsoluteCenter>
    </Box>
  )
}
