import { Button, EmptyState, ErrorState } from "@mosaik/mosaik-ui"
import { InboxIcon } from "lucide-solid"

export const App = () => (
  <>
    <EmptyState
      icon={<InboxIcon />}
      title="No orders yet"
      description="Orders show here as soon as customers place them."
      action={<Button size="sm">Create an order</Button>}
    />
    <ErrorState message="The server did not answer in time." onRetry={() => {}} />
  </>
)
