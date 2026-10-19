import { Button, PageHeader } from "@mosaik/mosaik-ui"
import { ShoppingCartIcon } from "lucide-solid"

export const App = () => (
  <PageHeader
    icon={<ShoppingCartIcon />}
    title="Orders"
    description="Every order of the last 90 days."
    actions={<Button>New order</Button>}
  />
)
