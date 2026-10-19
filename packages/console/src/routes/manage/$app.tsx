import { admin } from "@mosaik/auth/contract"
import { usePrincipal } from "@mosaik/auth/web"
import { Button, EmptyState, PageHeader, Tabs } from "@mosaik/mosaik-ui"
import { canManageApp } from "@mosaik/platform/contract"
import { css } from "@mosaik/styled-system/css"
import { QueryBoundary, searchValidator } from "@mosaik/web-kit"
import { useQuery } from "@tanstack/solid-query"
import { createFileRoute, Link } from "@tanstack/solid-router"
import { Schema } from "effect"
import ArrowLeft from "lucide-solid/icons/arrow-left"
import Lock from "lucide-solid/icons/lock"
import { For, Match, Show, Switch } from "solid-js"
import { AppOwners, AppRoles } from "../../access/About"
import { Members } from "../../access/Members"
import { aboutQuery, reviewsQuery } from "../../access/queries"
import { AccessRequests } from "../../access/Requests"
import { useConsoleExtensions } from "../../extensions"

const AppSearch = Schema.Struct({
  /** `roles`, `people`, `requests`, or a tab a host added. */
  tab: Schema.optional(Schema.String),
  /** On the requests tab: the answered ones. */
  answered: Schema.optional(Schema.Boolean),
})

/**
 * One app, for the people who decide who can use it: its roles and owners, who has which role,
 * and requests for access. The same page with and without the Portal (Core's notifications
 * link here); hosts can add tabs (see `ConsoleExtensions`).
 */
export const Route = createFileRoute("/_app/manage/$app")({
  validateSearch: searchValidator(AppSearch),
  component: ManagedApp,
})

const styles = {
  page: css({ display: "flex", flexDirection: "column", gap: "6" }),
  back: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "1",
    fontSize: "sm",
    color: "fg.muted",
    _hover: { color: "fg.default" },
  }),
  layout: css({
    display: "grid",
    gap: "6",
    gridTemplateColumns: { base: "1fr", lg: "minmax(0, 2fr) minmax(0, 1fr)" },
    alignItems: "start",
  }),
}

function ManagedApp() {
  const params = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const principal = usePrincipal()
  const extensions = useConsoleExtensions()
  const manages = () => canManageApp(principal(), params().app)
  const about = useQuery(() => ({ ...aboutQuery(params().app), enabled: manages() }))
  const waiting = useQuery(() => ({
    ...reviewsQuery(principal().user?.id ?? "", { app: params().app, status: "pending" }),
    enabled: manages(),
  }))
  const waitingCount = () => waiting.data?.length ?? 0
  const tab = () => search().tab ?? "roles"
  const extra = () => (extensions.appTabs ?? []).find((candidate) => candidate.id === tab())

  return (
    <div class={styles.page}>
      <Link to="/manage" class={styles.back}>
        <ArrowLeft size={14} /> Apps
      </Link>
      <Show
        when={manages()}
        fallback={
          <EmptyState
            icon={<Lock size={32} />}
            title="You don't decide about this app"
            description="Its owners decide who can use it, or the administrators when it has none."
          />
        }
      >
        <QueryBoundary query={about}>
          {(about) => (
            <>
              <PageHeader
                title={about().app.name}
                description={params().app}
                actions={
                  <Show when={principal().can(admin.perm("audit.view"))}>
                    <Link to="/admin/audit" search={{ app: params().app }}>
                      <Button variant="outline">Audit log</Button>
                    </Link>
                  </Show>
                }
              />
              <Tabs.Root
                value={tab()}
                onValueChange={({ value }) => void navigate({ search: { tab: value === "roles" ? undefined : value } })}
              >
                <Tabs.List>
                  <For
                    each={[
                      { value: "roles", label: "Roles" },
                      { value: "people", label: "People" },
                      { value: "requests", label: waitingCount() > 0 ? `Requests (${waitingCount()})` : "Requests" },
                      ...(extensions.appTabs ?? []).map((extension) => ({
                        value: extension.id,
                        label: extension.label,
                      })),
                    ]}
                  >
                    {(item) => <Tabs.Trigger value={item.value}>{item.label}</Tabs.Trigger>}
                  </For>
                  <Tabs.Indicator />
                </Tabs.List>
              </Tabs.Root>
              <Switch>
                <Match when={tab() === "people"}>
                  <Members about={about()} />
                </Match>
                <Match when={tab() === "requests"}>
                  <AccessRequests
                    app={params().app}
                    answered={search().answered === true}
                    onAnsweredChange={(answered) =>
                      void navigate({ search: (previous) => ({ ...previous, answered: answered || undefined }) })
                    }
                  />
                </Match>
                <Match when={extra()}>
                  {(extension) => {
                    const View = extension().component
                    return <View about={about()} />
                  }}
                </Match>
                <Match when={true}>
                  <div class={styles.layout}>
                    <AppRoles about={about()} />
                    <AppOwners about={about()} />
                  </div>
                </Match>
              </Switch>
            </>
          )}
        </QueryBoundary>
      </Show>
    </div>
  )
}
