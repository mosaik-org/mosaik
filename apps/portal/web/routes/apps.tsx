import { errorMessage, formatDateTime, formatRelativeTime, toast } from "@mosaik/client"
import { PLATFORM_EVENT_DESCRIPTIONS } from "@mosaik/core"
import {
  ActionMenu,
  type ActionMenuItem,
  Badge,
  Button,
  Card,
  CheckboxField,
  ConfirmDialog,
  IconButton,
  Modal,
  PasswordField,
  SelectField,
  Tabs,
  TextField,
} from "@mosaik/mosaik-ui"
import {
  type AdminApp,
  type AppKind,
  type AppSource,
  AppsAdmin,
  type DatabaseMode,
  type Inspection,
  InstallRequest,
  type InstallStatus,
} from "@mosaik/portal/contract"
import { css } from "@mosaik/styled-system/css"
import { createColumnHelper, DataTable } from "@mosaik/table"
import { QueryBoundary } from "@mosaik/web-kit"
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query"
import { createFileRoute } from "@tanstack/solid-router"
import Ellipsis from "lucide-solid/icons/ellipsis"
import Plus from "lucide-solid/icons/plus"
import { createSignal, For, onCleanup, Show } from "solid-js"
import { appsQuery, portalApi, portalKeys, registriesQuery } from "../queries"

/** The color palette a badge shows a state in. */
type Tone = "gray" | "accent" | "success" | "warning" | "danger"

export const Route = createFileRoute("/_app/portal/apps")({
  staticData: {
    title: "Apps",
    keywords: ["install", "docker", "image", "deploy", "upgrade"],
    permission: AppsAdmin.manage,
  },
  component: Apps,
})

const KIND: Record<AppKind, { label: string; tone: Tone }> = {
  configured: { label: "Configured", tone: "gray" },
  remote: { label: "Hosted elsewhere", tone: "accent" },
  image: { label: "Docker image", tone: "accent" },
}

const STATUS: Record<InstallStatus, { label: string; tone: Tone }> = {
  pending: { label: "Waiting to register", tone: "warning" },
  deploying: { label: "Deploying…", tone: "accent" },
  active: { label: "Running", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  disabled: { label: "Disabled", tone: "gray" },
}

const useInvalidate = () => {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: portalKeys.apps })
}
const onError = (title: string) => (error: unknown) => toast.error(title, errorMessage(error))

const styles = {
  stack: css({ display: "flex", flexDirection: "column", gap: "4" }),
  label: css({ fontSize: "sm", fontWeight: "medium" }),
  muted: css({ fontSize: "sm", color: "fg.muted" }),
  mono: css({ fontFamily: "mono", fontSize: "xs", wordBreak: "break-all" }),
  problems: css({
    display: "flex",
    flexDirection: "column",
    gap: "1",
    p: "3",
    borderRadius: "l2",
    bg: "danger.subtle.bg",
    color: "danger.plain.fg",
    fontSize: "sm",
  }),
  list: css({ display: "flex", flexWrap: "wrap", gap: "1" }),
  logs: css({
    maxH: "60vh",
    overflow: "auto",
    p: "3",
    borderRadius: "l2",
    bg: "gray.2",
    fontFamily: "mono",
    fontSize: "xs",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  }),
}

/** What the app asks for: shown before installing or updating. */
const ManifestSummary = (props: { inspection: Inspection }) => (
  <Show when={props.inspection.manifest}>
    {(manifest) => (
      <div class={styles.stack}>
        <div>
          <div class={css({ fontWeight: "semibold" })}>
            {manifest().name} <span class={styles.muted}>{manifest().version}</span>
          </div>
          <div class={styles.muted}>{manifest().description ?? manifest().id}</div>
          <Show when={props.inspection.digest}>{(digest) => <div class={styles.mono}>{digest()}</div>}</Show>
        </div>
        <div>
          <div class={styles.label}>Permissions</div>
          <div class={styles.list}>
            <For each={manifest().permissions}>
              {(permission) => (
                <Badge colorPalette={permission.dangerous ? "danger" : "neutral"}>{permission.key}</Badge>
              )}
            </For>
          </div>
        </div>
        <Show when={manifest().roles.length > 0}>
          <div>
            <div class={styles.label}>Roles</div>
            <div class={styles.list}>
              <For each={manifest().roles}>
                {(role) => (
                  <span title={role.grants.join(", ")}>
                    <Badge>{role.name}</Badge>
                  </span>
                )}
              </For>
            </div>
          </div>
        </Show>
        <Show when={manifest().notifications.length > 0}>
          <div>
            <div class={styles.label}>Notifications</div>
            <div class={styles.list}>
              <For each={manifest().notifications}>{(type) => <Badge>{type.key}</Badge>}</For>
            </div>
          </div>
        </Show>
        <Show when={manifest().events.length > 0}>
          <div>
            <div class={styles.label}>Receives events</div>
            <ul class={css({ fontSize: "sm", listStyle: "disc", pl: "5" })}>
              <For each={manifest().events}>{(type) => <li>{PLATFORM_EVENT_DESCRIPTIONS[type]}</li>}</For>
            </ul>
          </div>
        </Show>
        <Show when={props.inspection.problems.length > 0}>
          <div class={styles.problems}>
            <For each={props.inspection.problems}>{(problem) => <span>{problem}</span>}</For>
          </div>
        </Show>
      </div>
    )}
  </Show>
)

/** Inspects a source, asking again while a large image is still being pulled. */
const useInspect = () => {
  const [inspection, setInspection] = createSignal<Inspection>()
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))
  const inspect = useMutation(() => ({
    mutationFn: (source: AppSource) => portalApi((client) => client.admin.inspect({ payload: { source } })),
    onSuccess: (result, source) => {
      setInspection(result)
      if (result.state === "pulling") timer = setTimeout(() => inspect.mutate(source), 2000)
    },
    onError: onError("Could not read the app"),
  }))
  return {
    inspection,
    pending: () => inspect.isPending || inspection()?.state === "pulling",
    run: (source: AppSource) => {
      clearTimeout(timer)
      setInspection(undefined)
      inspect.mutate(source)
    },
    reset: () => {
      clearTimeout(timer)
      setInspection(undefined)
    },
  }
}

const KeyDialog = (props: { appKey: string | undefined; appId: string; onClose: () => void }) => (
  <Modal
    open={props.appKey !== undefined}
    onOpenChange={(open) => !open && props.onClose()}
    title="The app's key"
    description="Shown only now. Configure the app with it, then restart it: it registers itself and goes live."
    footer={<Button onClick={props.onClose}>Done</Button>}
  >
    <div class={styles.stack}>
      <pre class={styles.logs}>{`MOSAIK_APP_KEY=${props.appKey ?? ""}\nPLATFORM_URL=${location.origin}`}</pre>
      <Button
        variant="outline"
        onClick={() =>
          void navigator.clipboard
            .writeText(`MOSAIK_APP_KEY=${props.appKey}\nPLATFORM_URL=${location.origin}`)
            .then(() => toast.success("Copied"))
        }
      >
        Copy
      </Button>
      <p class={styles.muted}>
        The app must be reachable from the platform at its URL, and it must allow requests from the gateway.
      </p>
    </div>
  </Modal>
)

const InstallDialog = (props: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const invalidate = useInvalidate()
  const inspect = useInspect()
  const [kind, setKind] = createSignal<"Image" | "Url">("Image")
  const [location_, setLocation] = createSignal("")
  const [database, setDatabase] = createSignal<DatabaseMode>("platform")
  const [config, setConfig] = createSignal<Record<string, string>>({})
  const [key, setKey] = createSignal<{ appId: string; key: string }>()

  const source = (): AppSource =>
    kind() === "Image" ? { _tag: "Image", image: location_().trim() } : { _tag: "Url", url: location_().trim() }
  const ready = () => inspect.inspection()?.state === "ready" && inspect.inspection()?.problems.length === 0
  const manifest = () => inspect.inspection()?.manifest ?? null

  const close = () => {
    inspect.reset()
    setLocation("")
    setConfig({})
    props.onOpenChange(false)
  }

  const install = useMutation(() => ({
    mutationFn: () =>
      portalApi((client) =>
        client.admin.install({
          payload: new InstallRequest({
            source: source(),
            database: manifest()?.database ? database() : "none",
            config: config(),
          }),
        }),
      ),
    onSuccess: (installed) => {
      void invalidate()
      if (installed.key !== null) setKey({ appId: installed.app.id, key: installed.key })
      else toast.success("Installing", `${installed.app.name} is starting`)
      close()
    },
    onError: onError("Could not install the app"),
  }))

  return (
    <>
      <Modal
        open={props.open}
        onOpenChange={(open) => (open ? props.onOpenChange(true) : close())}
        title="Install an app"
        size="lg"
        footer={
          <>
            <Button variant="plain" onClick={close}>
              Cancel
            </Button>
            <Show
              when={ready()}
              fallback={
                <Button
                  loading={inspect.pending()}
                  disabled={location_().trim() === ""}
                  onClick={() => inspect.run(source())}
                >
                  Check
                </Button>
              }
            >
              <Button loading={install.isPending} onClick={() => install.mutate()}>
                Install
              </Button>
            </Show>
          </>
        }
      >
        <div class={styles.stack}>
          <Tabs.Root
            value={kind()}
            onValueChange={({ value }) => {
              setKind(value as "Image" | "Url")
              inspect.reset()
            }}
          >
            <Tabs.List>
              <For
                each={[
                  { value: "Image", label: "Docker image" },
                  { value: "Url", label: "Hosted elsewhere" },
                ]}
              >
                {(item) => <Tabs.Trigger value={item.value}>{item.label}</Tabs.Trigger>}
              </For>
              <Tabs.Indicator />
            </Tabs.List>
          </Tabs.Root>
          <TextField
            label={kind() === "Image" ? "Image" : "Base URL"}
            placeholder={kind() === "Image" ? "registry.example.com/team/crm:1.4.2" : "https://crm.team.example.com"}
            helperText={
              kind() === "Image"
                ? "The platform pulls it (with the registry credentials below) and runs it on this host."
                : "The app's manifest is read from <URL>/.well-known/mosaik-app.json."
            }
            value={location_()}
            onValueChange={(value) => {
              setLocation(value)
              inspect.reset()
            }}
          />
          <Show when={inspect.inspection()?.state === "pulling"}>
            <p class={styles.muted}>Pulling the image…</p>
          </Show>
          <Show when={inspect.inspection()?.error}>{(error) => <div class={styles.problems}>{error()}</div>}</Show>
          <Show when={inspect.inspection()}>{(result) => <ManifestSummary inspection={result()} />}</Show>
          <Show when={ready() && kind() === "Image" && manifest()}>
            {(manifest) => (
              <div class={styles.stack}>
                <Show when={manifest().database}>
                  <SelectField
                    label="Database"
                    items={[
                      { value: "platform", label: "Provided by the platform" },
                      { value: "app", label: "The app's own (DATABASE_URL)" },
                    ]}
                    value={database()}
                    onValueChange={(value) => setDatabase(value as DatabaseMode)}
                  />
                  <Show when={database() === "app"}>
                    <PasswordField
                      label="DATABASE_URL"
                      required
                      placeholder="postgres://user:password@host:5432/db"
                      value={config().DATABASE_URL ?? ""}
                      onValueChange={(value) => setConfig({ ...config(), DATABASE_URL: value })}
                    />
                  </Show>
                </Show>
                <For each={manifest().portal.config}>
                  {(setting) => (
                    <TextField
                      label={setting.name}
                      type={setting.secret ? "password" : "text"}
                      required={setting.required}
                      helperText={setting.description}
                      value={config()[setting.name] ?? ""}
                      onValueChange={(value) => setConfig({ ...config(), [setting.name]: value })}
                    />
                  )}
                </For>
              </div>
            )}
          </Show>
        </div>
      </Modal>
      <KeyDialog appKey={key()?.key} appId={key()?.appId ?? ""} onClose={() => setKey(undefined)} />
    </>
  )
}

const UpgradeDialog = (props: { app: AdminApp; open: boolean; onOpenChange: (open: boolean) => void }) => {
  const invalidate = useInvalidate()
  const inspect = useInspect()
  const [image, setImage] = createSignal(props.app.image ?? "")
  const upgrade = useMutation(() => ({
    mutationFn: () =>
      portalApi((client) => client.admin.upgrade({ params: { id: props.app.id }, payload: { image: image().trim() } })),
    onSuccess: () => {
      toast.success("Updating", `${props.app.name} → ${image()}`)
      void invalidate()
      props.onOpenChange(false)
    },
    onError: onError("Could not update the app"),
  }))
  const ready = () => inspect.inspection()?.state === "ready" && inspect.inspection()?.problems.length === 0

  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Update ${props.app.name}`}
      description="The new image is pulled and started; if it does not become healthy, the current version is restored."
      size="lg"
      footer={
        <>
          <Button variant="plain" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Show
            when={ready()}
            fallback={
              <Button loading={inspect.pending()} onClick={() => inspect.run({ _tag: "Image", image: image().trim() })}>
                Check
              </Button>
            }
          >
            <Button loading={upgrade.isPending} onClick={() => upgrade.mutate()}>
              Update
            </Button>
          </Show>
        </>
      }
    >
      <div class={styles.stack}>
        <TextField
          label="Image"
          value={image()}
          onValueChange={(value) => {
            setImage(value)
            inspect.reset()
          }}
        />
        <Show when={inspect.inspection()?.error}>{(error) => <div class={styles.problems}>{error()}</div>}</Show>
        <Show when={inspect.inspection()}>{(result) => <ManifestSummary inspection={result()} />}</Show>
      </div>
    </Modal>
  )
}

const ConfigDialog = (props: { app: AdminApp; open: boolean; onOpenChange: (open: boolean) => void }) => {
  const invalidate = useInvalidate()
  const [values, setValues] = createSignal<Record<string, string>>(
    Object.fromEntries(
      props.app.config.filter((setting) => !setting.secret).map((setting) => [setting.name, setting.value ?? ""]),
    ),
  )
  const save = useMutation(() => ({
    mutationFn: () =>
      portalApi((client) => client.admin.setConfig({ params: { id: props.app.id }, payload: { values: values() } })),
    onSuccess: () => {
      toast.success("Settings saved", "The app restarts to apply them")
      void invalidate()
      props.onOpenChange(false)
    },
    onError: onError("Could not save the settings"),
  }))
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Settings of ${props.app.name}`}
      description="Passed to the app as environment variables. Saving restarts it."
      footer={
        <>
          <Button variant="plain" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save and restart
          </Button>
        </>
      }
    >
      <div class={styles.stack}>
        <For each={props.app.config} fallback={<p class={styles.muted}>This app has no settings.</p>}>
          {(setting) => (
            <TextField
              label={setting.name}
              type={setting.secret ? "password" : "text"}
              required={setting.required && !setting.set}
              placeholder={setting.secret && setting.set ? "Stored; leave empty to keep" : undefined}
              helperText={setting.description}
              value={values()[setting.name] ?? ""}
              onValueChange={(value) => setValues({ ...values(), [setting.name]: value })}
            />
          )}
        </For>
      </div>
    </Modal>
  )
}

const LogsDialog = (props: { app: AdminApp; open: boolean; onOpenChange: (open: boolean) => void }) => {
  const logs = useQuery(() => ({
    queryKey: [...portalKeys.apps, props.app.id, "logs"],
    queryFn: () => portalApi((client) => client.admin.logs({ params: { id: props.app.id }, query: { tail: 300 } })),
    enabled: props.open,
    refetchInterval: 3000,
  }))
  return (
    <Modal open={props.open} onOpenChange={props.onOpenChange} title={`Logs of ${props.app.name}`} size="lg">
      <QueryBoundary query={logs}>
        {(data) => <pre class={styles.logs}>{data().lines || "No output yet."}</pre>}
      </QueryBoundary>
    </Modal>
  )
}

const UninstallDialog = (props: { app: AdminApp; open: boolean; onOpenChange: (open: boolean) => void }) => {
  const invalidate = useInvalidate()
  const [deleteData, setDeleteData] = createSignal(false)
  const uninstall = useMutation(() => ({
    mutationFn: () =>
      portalApi((client) =>
        client.admin.uninstall({
          params: { id: props.app.id },
          query: { deleteData: deleteData() ? "true" : "false" },
        }),
      ),
    onSuccess: () => {
      toast.success("Uninstalled", props.app.name)
      void invalidate()
      props.onOpenChange(false)
    },
    onError: onError("Could not uninstall the app"),
  }))
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Uninstall ${props.app.name}?`}
      description="Its pages, permissions and grants are removed. Users see it disappear on their next page load."
      footer={
        <>
          <Button variant="plain" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button colorPalette="danger" loading={uninstall.isPending} onClick={() => uninstall.mutate()}>
            Uninstall
          </Button>
        </>
      }
    >
      <Show when={props.app.database === "platform"}>
        <CheckboxField
          checked={deleteData()}
          onCheckedChange={setDeleteData}
          label="Also delete its database"
          helperText="Cannot be undone. Leave unchecked to keep the data for a reinstall."
        />
      </Show>
    </Modal>
  )
}

const AppActions = (props: { app: AdminApp }) => {
  const invalidate = useInvalidate()
  const [dialog, setDialog] = createSignal<"upgrade" | "config" | "logs" | "uninstall" | "rotate">()
  const [key, setKey] = createSignal<string>()
  const action = (name: string, run: () => Promise<unknown>) => () =>
    void run()
      .then(() => {
        toast.success(name, props.app.name)
        void invalidate()
      })
      .catch(onError(`${name} failed`))
  const id = { params: { id: props.app.id } }
  const rotate = useMutation(() => ({
    mutationFn: () => portalApi((client) => client.admin.rotateKey(id)),
    onSuccess: (result) => {
      setDialog(undefined)
      if (props.app.kind === "remote") setKey(result.key)
      else toast.success("New key issued", "The app restarts with it")
      void invalidate()
    },
    onError: onError("Could not issue a new key"),
  }))

  const items = (): ReadonlyArray<ActionMenuItem> => {
    const app = props.app
    const toggle: ActionMenuItem =
      app.status === "disabled"
        ? {
            value: "enable",
            label: "Enable",
            onSelect: action("Enabled", () => portalApi((client) => client.admin.enable(id))),
          }
        : {
            value: "disable",
            label: "Disable",
            onSelect: action("Disabled", () => portalApi((client) => client.admin.disable(id))),
          }
    // Its key and address come from Core's configuration.
    if (app.kind === "configured") return [toggle]
    const common: ReadonlyArray<ActionMenuItem> = [
      { value: "rotate", label: "Issue a new key…", onSelect: () => setDialog("rotate") },
      toggle,
      { value: "uninstall", label: "Uninstall…", danger: true, onSelect: () => setDialog("uninstall") },
    ]
    if (app.kind === "remote") {
      return [
        {
          value: "refresh",
          label: "Read manifest again",
          onSelect: action("Manifest refreshed", () => portalApi((client) => client.admin.refresh(id))),
        },
        ...common,
      ]
    }
    return [
      { value: "upgrade", label: "Update…", onSelect: () => setDialog("upgrade") },
      ...(app.previousImage === null
        ? []
        : [
            {
              value: "rollback",
              label: `Roll back to ${app.previousImage}`,
              onSelect: action("Rolling back", () => portalApi((client) => client.admin.rollback(id))),
            },
          ]),
      { value: "config", label: "Settings…", onSelect: () => setDialog("config") },
      { value: "logs", label: "Logs", onSelect: () => setDialog("logs") },
      {
        value: "restart",
        label: "Restart",
        onSelect: action("Restarting", () => portalApi((client) => client.admin.restart(id))),
      },
      ...common,
    ]
  }

  return (
    <>
      <ActionMenu
        trigger={(triggerProps) => (
          <IconButton variant="plain" aria-label={`Actions for ${props.app.name}`} size="2xs" {...triggerProps()}>
            <Ellipsis size={16} />
          </IconButton>
        )}
        items={items()}
      />
      <Show when={dialog() === "upgrade"}>
        <UpgradeDialog app={props.app} open onOpenChange={(open) => !open && setDialog(undefined)} />
      </Show>
      <Show when={dialog() === "config"}>
        <ConfigDialog app={props.app} open onOpenChange={(open) => !open && setDialog(undefined)} />
      </Show>
      <Show when={dialog() === "logs"}>
        <LogsDialog app={props.app} open onOpenChange={(open) => !open && setDialog(undefined)} />
      </Show>
      <Show when={dialog() === "uninstall"}>
        <UninstallDialog app={props.app} open onOpenChange={(open) => !open && setDialog(undefined)} />
      </Show>
      <ConfirmDialog
        open={dialog() === "rotate"}
        onOpenChange={(open) => !open && setDialog(undefined)}
        title={`Issue a new key for ${props.app.name}?`}
        description={
          props.app.kind === "remote"
            ? "The current key stops working at once: configure the app with the new one."
            : "The app is restarted with the new key."
        }
        confirmLabel="Issue new key"
        tone="danger"
        loading={rotate.isPending}
        onConfirm={() => rotate.mutate()}
      />
      <KeyDialog appKey={key()} appId={props.app.id} onClose={() => setKey(undefined)} />
    </>
  )
}

/** Apps ask for events at least every 25 seconds while running. */
const EVENTS_SILENT_AFTER_MS = 2 * 60 * 1000

/** How far the app has handled its platform events; lets admins skip one it keeps failing on. */
const EventsStatus = (props: { app: AdminApp }) => {
  const invalidate = useInvalidate()
  const [confirm, setConfirm] = createSignal(false)
  const skip = useMutation(() => ({
    mutationFn: () => portalApi((client) => client.admin.skipEvents({ params: { id: props.app.id } })),
    onSuccess: () => {
      setConfirm(false)
      toast.success("Event skipped", props.app.name)
      void invalidate()
    },
    onError: onError("Could not skip the event"),
  }))
  const silent = (polledAt: AdminApp["lastSeenAt"]) =>
    polledAt === null || Date.now() - polledAt.epochMilliseconds > EVENTS_SILENT_AFTER_MS

  return (
    <Show when={props.app.events}>
      {(events) => (
        <div class={css({ display: "flex", flexDirection: "column", gap: "1", alignItems: "flex-start" })}>
          <Show when={events().pending > 0}>
            <Badge colorPalette={events().lastError ? "danger" : "warning"}>
              {events().pending} {events().pending === 1 ? "event" : "events"} waiting
            </Badge>
          </Show>
          <Show when={events().lastError}>
            {(error) => (
              <span class={css({ fontSize: "xs", color: "danger.plain.fg", wordBreak: "break-word" })}>{error()}</span>
            )}
          </Show>
          <Show when={props.app.status === "active" && silent(events().polledAt)}>
            <span class={css({ fontSize: "xs", color: "warning.plain.fg" })}>
              <Show when={events().polledAt} fallback="Has not asked for events yet">
                {(at) => `Last asked for events ${formatRelativeTime(at())}`}
              </Show>
            </span>
          </Show>
          <Show when={events().lastError}>
            <Button size="xs" variant="outline" onClick={() => setConfirm(true)}>
              Skip this event…
            </Button>
          </Show>
          <ConfirmDialog
            open={confirm()}
            onOpenChange={setConfirm}
            title={`Skip the event ${props.app.name} keeps failing on?`}
            description="The app never receives this event; it goes on with the next ones."
            confirmLabel="Skip event"
            tone="danger"
            loading={skip.isPending}
            onConfirm={() => skip.mutate()}
          />
        </div>
      )}
    </Show>
  )
}

const column = createColumnHelper<AdminApp>()

const columns = column.columns([
  column.accessor("name", {
    header: "App",
    cell: (info) => (
      <div>
        <div class={css({ fontWeight: "medium" })}>{info.getValue()}</div>
        <div class={styles.mono}>{info.row.original.id}</div>
      </div>
    ),
  }),
  column.accessor("kind", {
    header: "Runs",
    cell: (info) => (
      <div class={css({ display: "flex", flexDirection: "column", gap: "1", alignItems: "flex-start" })}>
        <Badge colorPalette={KIND[info.getValue()].tone}>{KIND[info.getValue()].label}</Badge>
        <span class={styles.mono}>{info.row.original.image ?? info.row.original.url ?? ""}</span>
      </div>
    ),
  }),
  column.accessor("version", { header: "Version", cell: (info) => info.getValue() ?? "—" }),
  column.accessor("status", {
    header: "Status",
    enableSorting: false,
    cell: (info) => {
      const app = info.row.original
      return (
        <div class={css({ display: "flex", flexDirection: "column", gap: "1", alignItems: "flex-start", maxW: "sm" })}>
          <div class={css({ display: "flex", gap: "1", alignItems: "center" })}>
            <Badge colorPalette={STATUS[app.status].tone}>{STATUS[app.status].label}</Badge>
            <Show when={app.status === "active" || app.status === "pending"}>
              <Badge
                colorPalette={app.health === "healthy" ? "success" : app.health === "unhealthy" ? "danger" : "neutral"}
              >
                {app.health}
              </Badge>
            </Show>
          </div>
          <Show when={app.statusMessage}>
            {(message) => (
              <span class={css({ fontSize: "xs", color: "fg.muted", whiteSpace: "pre-wrap" })}>{message()}</span>
            )}
          </Show>
          <Show when={app.lastSeenAt}>
            {(at) => <span class={css({ fontSize: "xs", color: "fg.subtle" })}>seen {formatRelativeTime(at())}</span>}
          </Show>
          <EventsStatus app={app} />
        </div>
      )
    },
  }),
  column.display({
    id: "actions",
    header: "",
    meta: { align: "right", width: "56px" },
    cell: (info) => <AppActions app={info.row.original} />,
  }),
])

const RegistriesCard = () => {
  const registries = useQuery(registriesQuery)
  const queryClient = useQueryClient()
  const [server, setServer] = createSignal("")
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const invalidate = () => queryClient.invalidateQueries({ queryKey: portalKeys.registries })
  const save = useMutation(() => ({
    mutationFn: () =>
      portalApi((client) =>
        client.admin.setRegistry({
          payload: { server: server().trim(), username: username().trim(), password: password() },
        }),
      ),
    onSuccess: (credential) => {
      toast.success("Registry saved", credential.server)
      setServer("")
      setUsername("")
      setPassword("")
      void invalidate()
    },
    onError: onError("Could not save the registry"),
  }))
  const remove = useMutation(() => ({
    mutationFn: (host: string) => portalApi((client) => client.admin.deleteRegistry({ query: { server: host } })),
    onSuccess: () => void invalidate(),
    onError: onError("Could not remove the registry"),
  }))
  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Registry credentials</Card.Title>
        <Card.Description>
          Used to pull private images. Passwords are stored encrypted and never shown again.
        </Card.Description>
      </Card.Header>
      <Card.Body gap="4">
        <QueryBoundary query={registries}>
          {(data) => (
            <div class={css({ display: "flex", flexDirection: "column", gap: "2" })}>
              <For each={data()} fallback={<p class={styles.muted}>None: only public images can be pulled.</p>}>
                {(registry) => (
                  <div class={css({ display: "flex", alignItems: "center", gap: "3" })}>
                    <span class={css({ fontFamily: "mono", fontSize: "sm" })}>{registry.server}</span>
                    <span class={styles.muted}>
                      {registry.username} · added {formatDateTime(registry.createdAt)}
                    </span>
                    <div class={css({ flex: "1" })} />
                    <Button size="xs" variant="plain" onClick={() => remove.mutate(registry.server)}>
                      Remove
                    </Button>
                  </div>
                )}
              </For>
            </div>
          )}
        </QueryBoundary>
        <form
          class={css({
            display: "grid",
            gridTemplateColumns: { base: "1fr", md: "1fr 1fr 1fr auto" },
            gap: "3",
            alignItems: "end",
          })}
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <TextField
            label="Registry"
            placeholder="registry.example.com"
            required
            value={server()}
            onValueChange={setServer}
          />
          <TextField label="Username" required value={username()} onValueChange={setUsername} />
          <PasswordField label="Password or token" required value={password()} onValueChange={setPassword} />
          <Button type="submit" loading={save.isPending}>
            Save
          </Button>
        </form>
      </Card.Body>
    </Card.Root>
  )
}

function Apps() {
  const apps = useQuery(appsQuery)
  const [installing, setInstalling] = createSignal(false)
  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "6" })}>
      <Card.Root>
        <Card.Header flexDirection="row" alignItems="flex-start" justifyContent="space-between" gap="4">
          <div>
            <Card.Title>Apps</Card.Title>
            <Card.Description>
              Built-in apps ship with the platform. Install your team's apps from a Docker image or a URL; they appear
              without a platform release.
            </Card.Description>
          </div>
          <Button size="xs" onClick={() => setInstalling(true)}>
            <Plus size={16} />
            Install app
          </Button>
        </Card.Header>
        <Card.Body gap="4">
          <QueryBoundary query={apps}>
            {(data) => <DataTable columns={columns} data={data()} getRowId={(app) => app.id} emptyMessage="No apps." />}
          </QueryBoundary>
        </Card.Body>
      </Card.Root>
      <RegistriesCard />
      <InstallDialog open={installing()} onOpenChange={setInstalling} />
    </div>
  )
}
