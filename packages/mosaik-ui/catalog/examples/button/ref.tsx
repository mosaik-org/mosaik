import { Button } from "@mosaik/mosaik-ui"

export const App = () => {
  let ref: HTMLButtonElement | undefined
  return <Button ref={ref}>Click me</Button>
}
