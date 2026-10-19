import { AppLayout } from "@mosaik/web-kit"
import { createFileRoute } from "@tanstack/solid-router"
import { portal } from "../../manifest"

export const Route = createFileRoute("/_app/portal")({
  component: () => (
    <AppLayout
      app={portal}
      nav={[
        { to: "/portal/apps", label: "Apps" },
        { to: "/portal/usage", label: "Usage" },
      ]}
    />
  ),
})
