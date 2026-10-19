import { Button, Collapsible } from "@mosaik/mosaik-ui"
import { Box } from "styled-system/jsx"

export const App = () => {
  return (
    <Collapsible.Root>
      <Collapsible.Trigger
        asChild={(triggerProps) => (
          <Button variant="outline" {...triggerProps()}>
            Toggle
          </Button>
        )}
      />
      <Collapsible.Content>
        <Box p="4" mt="3" borderWidth="1px">
          Mosaik UI beautifully-designed, accessible components system and code distribution platform. Built with Panda
          CSS and supporting a wide range of JS frameworks
        </Box>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
