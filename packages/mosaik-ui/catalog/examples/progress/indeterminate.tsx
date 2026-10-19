import { Progress } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <Progress.Root value={null}>
      <Progress.Track>
        <Progress.Range />
      </Progress.Track>
    </Progress.Root>
  )
}
