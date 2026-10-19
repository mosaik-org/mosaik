import { Skeleton, SkeletonCircle } from "@mosaik/mosaik-ui"
import { Stack, Wrap } from "styled-system/jsx"

export const App = () => {
  return (
    <Wrap gap="4">
      <SkeletonCircle boxSize="12" />
      <Stack flex="1">
        <Skeleton height="5" />
        <Skeleton height="5" width="80%" />
      </Stack>
    </Wrap>
  )
}
