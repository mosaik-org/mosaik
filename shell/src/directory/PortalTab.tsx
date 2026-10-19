import { usePrincipal } from "@mosaik/auth/web"
import { formatRelativeTime } from "@mosaik/client"
import type { AppTab } from "@mosaik/console"
import { Button, Card, Stat } from "@mosaik/mosaik-ui"
import type { AppAbout } from "@mosaik/platform/contract"
import { css } from "@mosaik/styled-system/css"
import { QueryBoundary } from "@mosaik/web-kit"
import { queryOptions, useQuery } from "@tanstack/solid-query"
import { createSignal, Show } from "solid-js"
import { allApps, categoryOf } from "../apps"
import { portalApi } from "../portalApi"
import { CategoryDialog } from "./CategoryDialog"

const styles = {
  layout: css({
    display: "grid",
    gap: "6",
    gridTemplateColumns: { base: "1fr", lg: "repeat(2, 1fr)" },
    alignItems: "start",
  }),
  stats: css({ display: "grid", gap: "4", gridTemplateColumns: "repeat(3, 1fr)" }),
  column: css({ display: "flex", flexDirection: "column", gap: "3" }),
  category: css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "3" }),
  muted: css({ fontSize: "sm", color: "fg.muted" }),
}

const usageQuery = (user: string, app: string) =>
  queryOptions({
    queryKey: ["portal", user, "usage", app],
    queryFn: () => portalApi((client) => client.directory.usage({ params: { id: app } })),
  })

/** The Portal's part of an app's page: how much it is used, and where All apps lists it. */
const InThePortal = (props: { readonly about: AppAbout }) => {
  const principal = usePrincipal()
  const usage = useQuery(() => usageQuery(principal().user?.id ?? "", props.about.app.id))
  const app = () => allApps.find((candidate) => candidate.id === props.about.app.id)
  const [categorizing, setCategorizing] = createSignal(false)
  // Suggestions: the categories apps are listed under now.
  const categories = () => [...new Set(allApps.map(categoryOf))].sort()

  return (
    <div class={styles.layout}>
      <Card.Root>
        <Card.Header>
          <Card.Title>Use</Card.Title>
          <Card.Description>Over the last 30 days, and ever.</Card.Description>
        </Card.Header>
        <Card.Body gap="4">
          <QueryBoundary query={usage}>
            {(stats) => (
              <div class={styles.column}>
                <div class={styles.stats}>
                  <Stat label="This month" value={stats().activeUsers} hint="people" />
                  <Stat label="Ever" value={stats().users} hint="people" />
                  <Stat label="Opened" value={stats().opens} hint="times" />
                </div>
                <Show when={stats().lastOpenedAt}>
                  {(at) => <span class={styles.muted}>Last opened {formatRelativeTime(at())}.</span>}
                </Show>
              </div>
            )}
          </QueryBoundary>
        </Card.Body>
      </Card.Root>
      <Card.Root>
        <Card.Body gap="4">
          <Show
            when={app()}
            fallback={<span class={styles.muted}>Not listed in All apps: the Portal does not mount this app.</span>}
          >
            {(app) => (
              <>
                <div class={styles.category}>
                  <div>
                    <div class={css({ fontWeight: "semibold" })}>Listed under {categoryOf(app())}</div>
                    <div class={styles.muted}>In All apps, for everyone.</div>
                  </div>
                  <Button size="xs" variant="outline" onClick={() => setCategorizing(true)}>
                    Change…
                  </Button>
                </div>
                <CategoryDialog
                  app={app()}
                  categories={categories()}
                  open={categorizing()}
                  onOpenChange={setCategorizing}
                />
              </>
            )}
          </Show>
        </Card.Body>
      </Card.Root>
    </div>
  )
}

/** Added to the console's app pages in the shell. */
export const portalAppTab: AppTab = { id: "portal", label: "Portal", component: InThePortal }
