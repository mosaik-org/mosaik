import { Textarea } from "@mosaik/mosaik-ui"

export const App = () => {
  let ref: HTMLTextAreaElement | undefined
  return <Textarea ref={ref} aria-label="Notes" />
}
