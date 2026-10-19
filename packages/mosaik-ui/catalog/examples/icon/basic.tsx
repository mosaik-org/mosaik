import { Icon } from "@mosaik/mosaik-ui"
import { HeartIcon } from "lucide-solid"

export const App = () => {
  return <Icon size="lg" color="colorPalette.solid.bg" asChild={(props) => <HeartIcon {...props()} />} />
}
