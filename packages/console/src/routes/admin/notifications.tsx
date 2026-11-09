import { admin } from "@mosaik/auth/contract"
import { useCan } from "@mosaik/auth/web"
import { errorMessage, toast } from "@mosaik/client"
import {
  CreateTarget,
  type RoutingRule,
  type Target,
  type TargetKind,
  UpdateTarget,
} from "@mosaik/notifications/contract"
import { css } from "@mosaik/styled-system/css"
import { createColumnHelper, DataTable } from "@mosaik/table"
import {
  ActionMenu,
  Badge,
  Button,
  Card,
  CheckboxField,
  ConfirmDialog,
  IconButton,
  Modal,
  SelectField,
  TextField,
} from "@mosaik/ui"
import { QueryBoundary } from "@mosaik/web-kit"
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query"
import { createFileRoute } from "@tanstack/solid-router"
import Ellipsis from "lucide-solid/icons/ellipsis"
import Pencil from "lucide-solid/icons/pencil"
import Plus from "lucide-solid/icons/plus"
import { createSignal, For, Show } from "solid-js"
import { adminKeys, catalogQuery, routesQuery, targetsQuery } from "../../admin/queries"
import { notificationsApi } from "../../api"

export const Route = createFileRoute("/_app/admin/notifications")({
  staticData: {
    title: "Notification channels",
    keywords: ["teams", "slack", "webhook", "routing", "alerts"],
    permission: admin.perm("notifications.view"),
  },
  component: Notifications,
})

const KINDS: ReadonlyArray<{ value: TargetKind; label: string; help: string }> = [
  {
    value: "teams-webhook",
    label: "Teams (workflow webhook)",
    help: 'In Teams: channel ⋯ → Workflows → "Post to a channel when a webhook request is received", then paste its URL.',
  },
  {
    value: "slack-webhook",
    label: "Slack (incoming webhook)",
    help: "A Slack app's incoming webhook URL (https://hooks.slack.com/…); it always posts to one channel.",
  },
  {
    value: "slack-channel",
    label: "Slack (app)",
    help: "Posts as the Mosaik Slack app (needs SLACK_BOT_TOKEN). Invite the app to the channel first.",
  },
]
const kindLabel = (kind: TargetKind) => KINDS.find((k) => k.value === kind)?.label ?? kind

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 64)

const useInvalidate = () => {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: adminKeys.notifications })
}
const onError = (title: string) => (error: unknown) => toast.error(title, errorMessage(error))

/** Apps that may send to a target explicitly; none checked means all. */
const SourcePicker = (props: { value: ReadonlyArray<string>; onChange: (value: ReadonlyArray<string>) => void }) => {
  const catalog = useQuery(catalogQuery)
  const toggle = (id: string, checked: boolean) =>
    props.onChange(checked ? [...props.value, id] : props.value.filter((source) => source !== id))
  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "2" })}>
      <div class={css({ fontSize: "sm", fontWeight: "medium" })}>Apps that may send to it</div>
      <div class={css({ fontSize: "xs", color: "fg.muted" })}>
        None checked: every app. Routing rules below always apply.
      </div>
      <div class={css({ display: "grid", gridTemplateColumns: { base: "1fr", sm: "1fr 1fr" }, gap: "2", mt: "1" })}>
        <For each={(catalog.data ?? []).filter((app) => app.id !== admin.id)}>
          {(app) => (
            <CheckboxField
              checked={props.value.includes(app.id)}
              onCheckedChange={(checked) => toggle(app.id, checked)}
              label={app.name}
            />
          )}
        </For>
      </div>
    </div>
  )
}

const TargetDialog = (props: { open: boolean; onOpenChange: (open: boolean) => void; target?: Target }) => {
  const invalidate = useInvalidate()
  const editing = () => props.target !== undefined
  const [kind, setKind] = createSignal<TargetKind>(props.target?.kind ?? "teams-webhook")
  const [name, setName] = createSignal(props.target?.name ?? "")
  const [id, setId] = createSignal(props.target?.id ?? "")
  const [idTouched, setIdTouched] = createSignal(false)
  const [address, setAddress] = createSignal(props.target?.kind === "slack-channel" ? props.target.address : "")
  const [sources, setSources] = createSignal<ReadonlyArray<string>>(props.target?.allowedSources ?? [])
  const isChannel = () => kind() === "slack-channel"

  const save = useMutation(() => ({
    mutationFn: () => {
      const location = address().trim()
      const where = location.length === 0 ? {} : isChannel() ? { channel: location } : { url: location }
      const target = props.target
      return target === undefined
        ? notificationsApi((client) =>
            client.admin.createTarget({
              payload: new CreateTarget({ id: id(), name: name(), kind: kind(), allowedSources: sources(), ...where }),
            }),
          )
        : notificationsApi((client) =>
            client.admin.updateTarget({
              params: { id: target.id },
              payload: new UpdateTarget({ name: name(), allowedSources: sources(), ...where }),
            }),
          )
    },
    onSuccess: (target) => {
      toast.success(editing() ? "Channel updated" : "Channel added", target.name)
      void invalidate()
      props.onOpenChange(false)
    },
    onError: onError("Could not save the channel"),
  }))

  return (
    <Modal
      open={props.open}
      onOpenChange={(details) => props.onOpenChange(details.open)}
      title={editing() ? `Edit ${props.target?.name}` : "Add a Teams or Slack channel"}
      description="Messages and notifications can be sent or routed to it."
      footer={
        <>
          <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="target-form" loading={save.isPending}>
            {editing() ? "Save" : "Add channel"}
          </Button>
        </>
      }
    >
      <form
        id="target-form"
        class={css({ display: "flex", flexDirection: "column", gap: "4" })}
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
      >
        <Show when={!editing()}>
          <SelectField
            label="Type"
            options={KINDS}
            value={kind()}
            onValueChange={(value) => {
              const chosen = KINDS.find((candidate) => candidate.value === value)
              if (chosen !== undefined) setKind(chosen.value)
            }}
          />
        </Show>
        <p class={css({ fontSize: "xs", color: "fg.muted", mt: "-2" })}>
          {KINDS.find((k) => k.value === kind())?.help}
        </p>
        <TextField
          label="Name"
          required
          value={name()}
          onValueChange={(value) => {
            setName(value)
            if (!editing() && !idTouched()) setId(slugify(value))
          }}
        />
        <Show when={!editing()}>
          <TextField
            label="Id"
            required
            helperText="Used in code: To.target(id). Lowercase letters, digits and dashes."
            value={id()}
            onValueChange={(value) => {
              setIdTouched(true)
              setId(value)
            }}
          />
        </Show>
        <TextField
          label={isChannel() ? "Channel" : "Webhook URL"}
          type={isChannel() ? "text" : "url"}
          required={!editing()}
          placeholder={isChannel() ? "C0123456789 or #alerts" : "https://…"}
          helperText={
            editing() && !isChannel()
              ? `Currently ${props.target?.address}. Leave empty to keep it.`
              : isChannel()
                ? undefined
                : "Stored on the server and never shown again."
          }
          value={address()}
          onValueChange={setAddress}
        />
        <SourcePicker value={sources()} onChange={setSources} />
      </form>
    </Modal>
  )
}

const TargetActions = (props: { target: Target }) => {
  const invalidate = useInvalidate()
  const [editing, setEditing] = createSignal(false)
  const [deleting, setDeleting] = createSignal(false)

  const test = useMutation(() => ({
    mutationFn: () => notificationsApi((client) => client.admin.testTarget({ params: { id: props.target.id } })),
    onSuccess: (result) =>
      result.ok
        ? toast.success("Test message sent", props.target.name)
        : toast.error("Test message failed", result.error ?? undefined),
    onError: onError("Test message failed"),
  }))
  const remove = useMutation(() => ({
    mutationFn: () => notificationsApi((client) => client.admin.deleteTarget({ params: { id: props.target.id } })),
    onSuccess: () => {
      toast.success("Channel removed", props.target.name)
      void invalidate()
    },
    onError: onError("Could not remove the channel"),
  }))

  return (
    <>
      <ActionMenu
        trigger={(triggerProps) => (
          <IconButton variant="ghost" aria-label={`Actions for ${props.target.name}`} size="xs" {...triggerProps()}>
            <Ellipsis />
          </IconButton>
        )}
        items={[
          { value: "test", label: "Send test message", onSelect: () => test.mutate() },
          { value: "edit", label: "Edit…", onSelect: () => setEditing(true) },
          { value: "delete", label: "Remove…", danger: true, onSelect: () => setDeleting(true) },
        ]}
      />
      <Show when={editing()}>
        <TargetDialog open={editing()} onOpenChange={setEditing} target={props.target} />
      </Show>
      <ConfirmDialog
        open={deleting()}
        onOpenChange={(details) => setDeleting(details.open)}
        title={`Remove ${props.target.name}?`}
        message="Its routing rules are removed too, and pending deliveries to it fail."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => remove.mutateAsync()}
      />
    </>
  )
}

const targetColumn = createColumnHelper<Target>()

const TargetsCard = () => {
  const can = useCan()
  const targets = useQuery(targetsQuery)
  const [adding, setAdding] = createSignal(false)
  const manage = () => can(admin.perm("notifications.manage"))

  const columns = targetColumn.columns([
    targetColumn.accessor("name", {
      header: "Channel",
      cell: (info) => (
        <div>
          <div class={css({ fontWeight: "medium" })}>{info.getValue()}</div>
          <div class={css({ fontSize: "xs", color: "fg.muted", fontFamily: "mono" })}>{info.row.original.id}</div>
        </div>
      ),
    }),
    targetColumn.accessor("kind", {
      header: "Type",
      cell: (info) => <Badge>{kindLabel(info.getValue())}</Badge>,
    }),
    targetColumn.accessor("address", {
      header: "Posts to",
      enableSorting: false,
      cell: (info) => <span class={css({ fontFamily: "mono", fontSize: "xs" })}>{info.getValue()}</span>,
    }),
    targetColumn.accessor("allowedSources", {
      header: "Apps",
      enableSorting: false,
      cell: (info) => (info.getValue().length === 0 ? "All" : info.getValue().join(", ")),
    }),
    targetColumn.display({
      id: "actions",
      header: "",
      meta: { align: "right", width: "56px" },
      cell: (info) => <Show when={manage()}>{<TargetActions target={info.row.original} />}</Show>,
    }),
  ])

  return (
    <Card.Root>
      <Card.Header flexDirection="row" alignItems="flex-start" justifyContent="space-between" gap="4">
        <div>
          <Card.Title>Teams & Slack channels</Card.Title>
          <Card.Description>
            Where apps can post with To.target(id), and where routing rules send messages and notifications.
          </Card.Description>
        </div>
        <Show when={manage()}>
          <Button size="xs" onClick={() => setAdding(true)}>
            <Plus size={16} />
            Add channel
          </Button>
        </Show>
      </Card.Header>
      <Card.Body gap="4">
        <QueryBoundary query={targets}>
          {(data) => (
            <DataTable
              columns={columns}
              data={data()}
              getRowId={(target) => target.id}
              loading={targets.isFetching}
              emptyMessage="No channels yet."
            />
          )}
        </QueryBoundary>
        <Show when={adding()}>
          <TargetDialog open={adding()} onOpenChange={setAdding} />
        </Show>
      </Card.Body>
    </Card.Root>
  )
}

const RouteDialog = (props: {
  rule: RoutingRule
  targets: ReadonlyArray<Target>
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const invalidate = useInvalidate()
  const [selected, setSelected] = createSignal<ReadonlyArray<string>>(props.rule.targets)
  const save = useMutation(() => ({
    mutationFn: () =>
      notificationsApi((client) => client.admin.setRoute({ payload: { key: props.rule.key, targets: selected() } })),
    onSuccess: () => {
      toast.success("Routing updated", props.rule.key)
      void invalidate()
      props.onOpenChange(false)
    },
    onError: onError("Could not update routing"),
  }))
  const toggle = (id: string, checked: boolean) =>
    setSelected(checked ? [...selected(), id] : selected().filter((target) => target !== id))

  return (
    <Modal
      open={props.open}
      onOpenChange={(details) => props.onOpenChange(details.open)}
      title={`Route ${props.rule.key}`}
      description={props.rule.description ?? "Every message of this kind is also posted to the checked channels."}
      footer={
        <>
          <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div class={css({ display: "flex", flexDirection: "column", gap: "3" })}>
        <For
          each={props.targets}
          fallback={<p class={css({ color: "fg.muted", fontSize: "sm" })}>Add a channel first.</p>}
        >
          {(target) => (
            <CheckboxField
              checked={selected().includes(target.id)}
              onCheckedChange={(checked) => toggle(target.id, checked)}
              label={target.name}
              helperText={kindLabel(target.kind)}
            />
          )}
        </For>
      </div>
    </Modal>
  )
}

const ruleColumn = createColumnHelper<RoutingRule>()

const RoutingCard = () => {
  const can = useCan()
  const rules = useQuery(routesQuery)
  const targets = useQuery(targetsQuery)
  const [editing, setEditing] = createSignal<RoutingRule>()
  const targetName = (id: string) => targets.data?.find((target) => target.id === id)?.name ?? id

  const columns = ruleColumn.columns([
    ruleColumn.accessor("key", {
      header: "Notification or message",
      cell: (info) => (
        <div>
          <div class={css({ fontFamily: "mono", fontSize: "xs" })}>{info.getValue()}</div>
          <Show when={info.row.original.description}>
            {(description) => <div class={css({ fontSize: "xs", color: "fg.muted" })}>{description()}</div>}
          </Show>
        </div>
      ),
    }),
    ruleColumn.accessor("category", {
      header: "Kind",
      cell: (info) => <Badge>{info.getValue() === "notification" ? "Notification" : "Message"}</Badge>,
    }),
    ruleColumn.accessor("targets", {
      header: "Also posted to",
      enableSorting: false,
      cell: (info) => (
        <div class={css({ display: "flex", gap: "1", flexWrap: "wrap" })}>
          <For each={info.getValue()} fallback={<span class={css({ color: "fg.muted" })}>—</span>}>
            {(id) => <Badge>{targetName(id)}</Badge>}
          </For>
        </div>
      ),
    }),
    ruleColumn.display({
      id: "actions",
      header: "",
      meta: { align: "right", width: "56px" },
      cell: (info) => (
        <Show when={can(admin.perm("notifications.manage"))}>
          <IconButton
            variant="ghost"
            aria-label={`Route ${info.row.original.key}`}
            size="xs"
            onClick={() => setEditing(info.row.original)}
          >
            <Pencil />
          </IconButton>
        </Show>
      ),
    }),
  ])

  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Routing</Card.Title>
        <Card.Description>
          Post notification types and message kinds to channels, in addition to their recipients. Message kinds appear
          once they were sent.
        </Card.Description>
      </Card.Header>
      <Card.Body gap="4">
        <QueryBoundary query={rules}>
          {(data) => (
            <DataTable
              columns={columns}
              data={data()}
              getRowId={(rule) => rule.key}
              loading={rules.isFetching}
              emptyMessage="No notification types or message kinds yet."
            />
          )}
        </QueryBoundary>
        <Show when={editing()}>
          {(rule) => (
            <RouteDialog
              rule={rule()}
              targets={targets.data ?? []}
              open
              onOpenChange={(open) => {
                if (!open) setEditing(undefined)
              }}
            />
          )}
        </Show>
      </Card.Body>
    </Card.Root>
  )
}

function Notifications() {
  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "6" })}>
      <TargetsCard />
      <RoutingCard />
    </div>
  )
}
