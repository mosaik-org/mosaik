import { usePrincipal } from "@mosaik/auth/web"
import { Card, EmptyState, PageHeader } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { QueryBoundary } from "@mosaik/web-kit"
import { useQuery } from "@tanstack/solid-query"
import { createFileRoute, Link } from "@tanstack/solid-router"
import LayoutGrid from "lucide-solid/icons/layout-grid"
import { For, Show } from "solid-js"
import { managedAppsQuery, reviewsQuery } from "../../access/queries"

/** The apps someone decides about: the ones they own, or every app for admins. */
export const Route = createFileRoute("/_app/manage/")({
  staticData: { title: "Apps you manage", keywords: ["owner", "members", "people", "roles"] },
  component: ManagedApps,
})

const styles = {
  page: css({ display: "flex", flexDirection: "column", gap: "6" }),
  grid: css({
    display: "grid",
    gap: "4",
    gridTemplateColumns: { base: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" },
  }),
  app: css({ display: "flex", flexDirection: "column", gap: "1", _hover: { borderColor: "accent.solid.bg" } }),
  name: css({ fontWeight: "semibold", display: "flex", justifyContent: "space-between", gap: "2" }),
  muted: css({ fontSize: "sm", color: "fg.muted" }),
  waiting: css({ fontSize: "sm", color: "accent.plain.fg" }),
}

function ManagedApps() {
  const principal = usePrincipal()
  const user = () => principal().user?.id ?? ""
  const apps = useQuery(() => managedAppsQuery(user()))
  const waiting = useQuery(() => reviewsQuery(user(), { status: "pending" }))
  const waitingFor = (app: string) => (waiting.data ?? []).filter((request) => request.app === app).length

  return (
    <div class={styles.page}>
      <PageHeader
        title="Apps"
        description="Who can use the apps you decide about, and their requests for access."
        icon={<LayoutGrid size={20} />}
      />
      <QueryBoundary query={apps}>
        {(list) => (
          <Show
            when={list().length > 0}
            fallback={
              <EmptyState
                icon={<LayoutGrid size={32} />}
                title="You don't decide about any app"
                description="Each app's owners decide who can use it; administrators decide about all of them."
              />
            }
          >
            <div class={styles.grid}>
              <For each={list()}>
                {(app) => (
                  <Link to="/manage/$app" params={{ app: app.id }}>
                    <Card.Root class={styles.app}>
                      <Card.Body gap="4">
                        <span class={styles.name}>
                          {app.name}
                          <Show when={waitingFor(app.id) > 0}>
                            <span class={styles.waiting}>{waitingFor(app.id)} waiting</span>
                          </Show>
                        </span>
                        <span class={styles.muted}>{app.description ?? app.id}</span>
                      </Card.Body>
                    </Card.Root>
                  </Link>
                )}
              </For>
            </div>
          </Show>
        )}
      </QueryBoundary>
    </div>
  )
}
