import { Spinner, Text } from "@mosaik/mosaik-ui"
import { VStack } from "styled-system/jsx"

export const App = () => {
  return (
    <VStack gap="1.5">
      <Spinner />
      <Text color="fg.muted">Loading Users ...</Text>
    </VStack>
  )
}
