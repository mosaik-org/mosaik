import { signInUrl } from "@mosaik/auth/contract"
import { usePrincipal } from "@mosaik/auth/web"
import { AppOwners, AppRoles, aboutQuery } from "@mosaik/console"
import type { AnyApp } from "@mosaik/core"
import { AppIcon, appColor, PageTitle } from "@mosaik/frame"
import { Badge, Button, IconButton } from "@mosaik/mosaik-ui"
import { canManageApp } from "@mosaik/platform/contract"
import { css } from "@mosaik/styled-system/css"
import { QueryBoundary } from "@mosaik/web-kit"
import { useQuery } from "@tanstack/solid-query"
import { createFileRoute, Link } from "@tanstack/solid-router"
import ArrowLeft from "lucide-solid/icons/arrow-left"
import Lock from "lucide-solid/icons/lock"
import Pin from "lucide-solid/icons/pin"
import { createMemo, createSignal, Match, Show, Switch } from "solid-js"
import { allApps, appHref } from "../../apps"
import { NotFound } from "../../components/NotFound"
import { RequestAccessDialog } from "../../directory/RequestAccessDialog"
import { useMyApps } from "../../workspace/myApps"
import { accessRequestsQuery } from "../../workspace/queries"

/** One app in the directory: what it is, its roles and whom to ask; for its owners, a way to manage it. */
export const Route = createFileRoute("/_app/directory/$app")({
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
  muted: css({ fontSize: "sm", color: "fg.muted" }),
  pinned: css({ color: "fg.default", fill: "currentColor" }),
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
      <Show when={canManageApp(principal(), props.app.id)}>
        <Button
          variant="outline"
          asChild={(link) => (
            <Link to="/manage/$app" params={{ app: props.app.id }} {...link()}>
              Manage
            </Link>
          )}
        />
      </Show>
      <Show when={available() && apps.canPin()}>
        <IconButton
          aria-label={apps.isPinned(props.app.id) ? `Unpin ${props.app.name}` : `Pin ${props.app.name}`}
          variant="outline"
          aria-pressed={apps.isPinned(props.app.id)}
          onClick={() => (apps.isPinned(props.app.id) ? apps.unpin(props.app.id) : apps.pin(props.app.id))}
        >
          <Pin size={16} class={apps.isPinned(props.app.id) ? styles.pinned : undefined} />
        </IconButton>
      </Show>
      <Switch>
        <Match when={available()}>
          <Button
            asChild={(link) => (
              <Link to={appHref(props.app)} {...link()}>
                Open {props.app.name}
              </Link>
            )}
          />
        </Match>
        <Match when={user() === undefined}>
          <Button
            asChild={(link) => (
              <a href={signInUrl(`/directory/${props.app.id}`)} {...link()}>
                Log in
              </a>
            )}
          />
        </Match>
        <Match when={latest()?.status === "pending"}>
          <Badge variant="dot" colorPalette="accent">
            Access requested
          </Badge>
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

/** Its roles and owners, for anyone logged in: what to ask for, and whom. */
const About = (props: { app: AnyApp }) => {
  const principal = usePrincipal()
  const about = useQuery(() => ({ ...aboutQuery(props.app.id), enabled: principal().user !== null }))
  return (
    <Show
      when={principal().user !== null}
      fallback={<p class={styles.muted}>Log in to see its roles and whom to ask for access.</p>}
    >
      <QueryBoundary query={about}>
        {(about) => (
          <div class={styles.layout}>
            <AppRoles about={about()} />
            <AppOwners about={about()} />
          </div>
        )}
      </QueryBoundary>
    </Show>
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
          <PageTitle
            title={app.name}
            icon={<AppIcon name={app.portal.icon} size={18} color={appColor(app)} />}
            actions={<Actions app={app} />}
          />
          <About app={app} />
        </div>
      )}
    </Show>
  )
}
