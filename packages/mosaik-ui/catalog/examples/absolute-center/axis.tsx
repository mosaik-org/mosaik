import { AbsoluteCenter } from "@mosaik/mosaik-ui"
import { Box } from "styled-system/jsx"
import { absoluteCenter } from "styled-system/recipes"
import { Showcase } from "../../showcase"

export const App = () => (
  <Showcase values={absoluteCenter.variantMap.axis} wide>
    {(axis) => (
      <Box position="relative" height="24" borderWidth="1px" borderRadius="l2">
        <AbsoluteCenter axis={axis}>
          <Box bg="gray.subtle.bg" px="3" py="1" borderRadius="l1">
            {axis}
          </Box>
        </AbsoluteCenter>
      </Box>
    )}
  </Showcase>
)
