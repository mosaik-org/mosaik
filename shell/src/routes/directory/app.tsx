import { signInUrl } from "@mosaik/auth/contract"
import { usePrincipal } from "@mosaik/auth/web"
import { formatRelativeTime } from "@mosaik/client"
import type { AnyApp } from "@mosaik/core"
import { type AppAbout, canManageApp } from "@mosaik/platform/contract"
import { css } from "@mosaik/styled-system/css"
import { AppIcon, Avatar, Badge, Button, Card, CardHeader, IconButton, PageHeader, Stat, Tabs } from "@mosaik/ui"
import { QueryBoundary, searchValidator } from "@mosaik/web-kit"
import { useQuery } from "@tanstack/solid-query"
import { createFileRoute, Link } from "@tanstack/solid-router"
import { Schema } from "effect"
import ArrowLeft from "lucide-solid/icons/arrow-left"
import Lock from "lucide-solid/icons/lock"
import Pin from "lucide-solid/icons/pin"
import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js"
import { Members } from "../../access/Members"
import { aboutQuery, appUsageQuery, reviewsQuery } from "../../access/queries"
import { AccessRequests } from "../../access/Requests"
import { RoleDetails } from "../../access/RoleDetails"
import { allApps, appHref, categoryOf } from "../../apps"
import { NotFound } from "../../components/NotFound"
import { CategoryDialog } from "../../directory/CategoryDialog"
import { RequestAccessDialog } from "../../directory/RequestAccessDialog"
import { useMyApps } from "../../workspace/myApps"
import { accessRequestsQuery } from "../../workspace/queries"

const Tab = Schema.Literals(["about", "people", "requests"])
const isTab = Schema.is(Tab)

const AppSearch = Schema.Struct({
  tab: Schema.optional(Tab),
  /** On the requests tab: the answered ones. */
  answered: Schema.optional(Schema.Boolean),
})

/** One app: what it is, its roles and whom to ask; for its owners, who can use it and their requests. */
export const Route = createFileRoute("/_app/directory/$app")({
  validateSearch: searchValidator(AppSearch),
  component: AppPage,
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
  actions: css({ display: "flex", alignItems: "center", gap: "2" }),
  layout: css({
    display: "grid",
    gap: "6",
    gridTemplateColumns: { base: "1fr", lg: "minmax(0, 2fr) minmax(0, 1fr)" },
    alignItems: "start",
  }),
  column: css({ display: "flex", flexDirection: "column", gap: "6", minW: "0" }),
  roles: css({ display: "grid", gap: "4", gridTemplateColumns: { base: "1fr", md: "repeat(2, 1fr)" } }),
  role: css({ display: "flex", flexDirection: "column", gap: "2" }),
  roleName: css({ fontWeight: "semibold", display: "flex", gap: "2", alignItems: "center" }),
  people: css({ display: "flex", flexDirection: "column", gap: "3" }),
  person: css({ display: "flex", alignItems: "center", gap: "3", fontSize: "sm" }),
  muted: css({ fontSize: "sm", color: "fg.muted" }),
  stats: css({ display: "grid", gap: "4", gridTemplateColumns: "repeat(3, 1fr)" }),
  category: css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "3" }),
  pinned: css({ color: "accent.text", fill: "currentColor" }),
}

const whoCanUse = (about: AppAbout) =>
  about.openTo === "anonymous"
    ? "Everyone, even without logging in."
    : about.openTo === "authenticated"
      ? "Everyone who is logged in."
      : "People with one of its roles."

const About = (props: { app: AnyApp; about: AppAbout; manages: boolean }) => {
  const principal = usePrincipal()
  const usage = useQuery(() => ({
    ...appUsageQuery(principal().user?.id ?? "", props.app.id),
    enabled: props.manages,
  }))
  const [categorizing, setCategorizing] = createSignal(false)
  // Suggestions: the categories apps are listed under now.
  const categories = () => [...new Set(allApps.map(categoryOf))].sort()
  const roles = () => props.about.app.roles.filter((role) => !role.stale)

  return (
    <div class={styles.layout}>
      <div class={styles.column}>
        <Card>
          <CardHeader title="Roles" description={`Who can use it: ${whoCanUse(props.about)}`} />
          <div class={styles.roles}>
            <For each={roles()}>
              {(role) => (
                <div class={styles.role}>
                  <span class={styles.roleName}>
                    {role.name}
                    <Show when={role.isOwner}>
                      <Badge tone="accent">decides who can use it</Badge>
                    </Show>
                  </span>
                  <RoleDetails role={role} appName={props.about.app.name} access={props.about.app.access} />
                </div>
              )}
            </For>
          </div>
        </Card>
      </div>
      <div class={styles.column}>
        <Card>
          <CardHeader title="Owners" description="They decide who can use it." />
          <div class={styles.people}>
            <For
              each={props.about.owners}
              fallback={<span class={styles.muted}>No owners yet: administrators decide who can use it.</span>}
            >
              {(owner) => (
                <div class={styles.person}>
                  <Avatar name={owner.name} src={owner.image} size="sm" />
                  <div>
                    <div>{owner.name}</div>
                    <a href={`mailto:${owner.email}`} class={styles.muted}>
                      {owner.email}
                    </a>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Card>
        <Show when={props.manages}>
          <Card>
            <CardHeader title="Use" description="Over the last 30 days, and ever." />
            <QueryBoundary query={usage}>
              {(stats) => (
                <div class={styles.people}>
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
          </Card>
          <Card>
            <div class={styles.category}>
              <div>
                <div class={css({ fontWeight: "semibold" })}>Listed under {categoryOf(props.app)}</div>
                <div class={styles.muted}>In All apps, for everyone.</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setCategorizing(true)}>
                Change…
              </Button>
            </div>
          </Card>
          <CategoryDialog
            app={props.app}
            categories={categories()}
            open={categorizing()}
            onOpenChange={setCategorizing}
          />
        </Show>
      </div>
    </div>
  )
}

/** Open it, ask for it, or log in for it; and pin it. */
const Actions = (props: { app: AnyApp }) => {
  const principal = usePrincipal()
  const apps = useMyApps()
  const user = () => principal().user?.id
  const mine = useQuery(() => ({ ...accessRequestsQuery(user() ?? ""), enabled: user() !== undefined }))
  const latest = () => mine.data?.find((request) => request.app === props.app.id)
  const [requesting, setRequesting] = createSignal(false)
  const available = () => principal().can(props.app.accessPermission)

  return (
    <div class={styles.actions}>
      <Show when={available() && apps.canPin()}>
        <IconButton
          label={apps.isPinned(props.app.id) ? `Unpin ${props.app.name}` : `Pin ${props.app.name}`}
          variant="outline"
          aria-pressed={apps.isPinned(props.app.id)}
          onClick={() => (apps.isPinned(props.app.id) ? apps.unpin(props.app.id) : apps.pin(props.app.id))}
        >
          <Pin size={16} class={apps.isPinned(props.app.id) ? styles.pinned : undefined} />
        </IconButton>
      </Show>
      <Switch>
        <Match when={available()}>
          <Link to={appHref(props.app)}>
            <Button>Open {props.app.name}</Button>
          </Link>
        </Match>
        <Match when={user() === undefined}>
          <a href={signInUrl(`/directory/${props.app.id}`)}>
            <Button>Log in</Button>
          </a>
        </Match>
        <Match when={latest()?.status === "pending"}>
          <Badge tone="accent">Access requested</Badge>
        </Match>
        <Match when={true}>
          <Button variant="outline" onClick={() => setRequesting(true)}>
            <Lock size={14} /> {latest()?.status === "declined" ? "Ask again" : "Request access"}
          </Button>
        </Match>
      </Switch>
      <RequestAccessDialog app={props.app} open={requesting()} onOpenChange={setRequesting} />
    </div>
  )
}

const Managed = (props: { app: AnyApp }) => {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const principal = usePrincipal()
  const about = useQuery(() => ({ ...aboutQuery(props.app.id), enabled: principal().user !== null }))
  const manages = () => canManageApp(principal(), props.app.id)
  const tab = () => (manages() ? (search().tab ?? "about") : "about")
  const waiting = useQuery(() => ({
    ...reviewsQuery(principal().user?.id ?? "", { app: props.app.id, status: "pending" }),
    enabled: manages(),
  }))
  const waitingCount = () => waiting.data?.length ?? 0

  return (
    <>
      <Show when={manages()}>
        <Tabs
          value={tab()}
          onValueChange={(value) =>
            void navigate({ search: { tab: value === "about" || !isTab(value) ? undefined : value } })
          }
          items={[
            { value: "about", label: "About" },
            { value: "people", label: "People" },
            { value: "requests", label: waitingCount() > 0 ? `Requests (${waitingCount()})` : "Requests" },
          ]}
        />
      </Show>
      <Show
        when={principal().user !== null}
        fallback={<p class={styles.muted}>Log in to see its roles and whom to ask for access.</p>}
      >
        <QueryBoundary query={about}>
          {(about) => (
            <Switch>
              <Match when={tab() === "about"}>
                <About app={props.app} about={about()} manages={manages()} />
              </Match>
              <Match when={tab() === "people"}>
                <Members about={about()} />
              </Match>
              <Match when={tab() === "requests"}>
                <AccessRequests
                  app={props.app.id}
                  answered={search().answered === true}
                  onAnsweredChange={(answered) =>
                    void navigate({ search: (previous) => ({ ...previous, answered: answered || undefined }) })
                  }
                />
              </Match>
            </Switch>
          )}
        </QueryBoundary>
      </Show>
    </>
  )
}

function AppPage() {
  const params = Route.useParams()
  const app = createMemo(() => allApps.find((candidate) => candidate.id === params().app))

  return (
    <Show when={app()} fallback={<NotFound />} keyed>
      {(app) => (
        <div class={styles.page}>
          <Link to="/directory" class={styles.back}>
            <ArrowLeft size={14} /> All apps
          </Link>
          <PageHeader
            title={app.name}
            description={app.description}
            icon={<AppIcon name={app.portal.icon} size={20} />}
            actions={<Actions app={app} />}
          />
          <Managed app={app} />
        </div>
      )}
    </Show>
  )
}
