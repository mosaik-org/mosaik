import { RatingGroup } from "@mosaik/mosaik-ui"

export const App = () => {
  return (
    <RatingGroup.Root count={5} defaultValue={3}>
      <RatingGroup.HiddenInput />
      <RatingGroup.Control />
    </RatingGroup.Root>
  )
}
