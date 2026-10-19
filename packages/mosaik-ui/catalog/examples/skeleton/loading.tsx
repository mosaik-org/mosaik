import { Button, Skeleton, Text } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const [loading, setLoading] = createSignal(true)

  return (
    <Stack align="flex-start" gap="4">
      <Skeleton loading={loading()}>
        <Text>Mosaik UI rocks 🚀</Text>
      </Skeleton>
      <Button variant="surface" onClick={() => setLoading((c) => !c)}>
        Toggle
      </Button>
    </Stack>
  )
}
