import { Input } from "@mosaik/mosaik-ui"

export const App = () => {
  let ref: HTMLInputElement | undefined
  return <Input ref={ref} aria-label="Name" />
}
