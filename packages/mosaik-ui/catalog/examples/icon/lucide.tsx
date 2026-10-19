import { Icon } from "@mosaik/mosaik-ui"
import { RocketIcon } from "lucide-solid"

export const App = () => {
  return <Icon size="lg" color="colorPalette.solid.bg" asChild={(props) => <RocketIcon {...props()} />} />
}
