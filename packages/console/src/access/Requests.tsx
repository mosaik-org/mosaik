import { usePrincipal } from "@mosaik/auth/web"
import { errorMessage, formatDateTime, formatRelativeTime, toast } from "@mosaik/client"
import { Badge, Button, EmptyState, Modal, SelectField, Tabs, TextareaField, Tooltip } from "@mosaik/mosaik-ui"
import type { AccessRequest } from "@mosaik/platform/contract"
import { css } from "@mosaik/styled-system/css"
import { createColumnHelper, DataTable } from "@mosaik/table"
import { QueryBoundary } from "@mosaik/web-kit"
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query"
import { Link } from "@tanstack/solid-router"
import Inbox from "lucide-solid/icons/inbox"
import { createSignal, For, Match, Show, Switch } from "solid-js"
import { platformApi } from "../api"
import { aboutQuery, accessKeys, reviewsQuery } from "./queries"
import { RoleDetails } from "./RoleDetails"

const styles = {
  stack: css({ display: "flex", flexDirection: "column", gap: "4" }),
  person: css({ display: "flex", flexDirection: "column", minW: "0" }),
  muted: css({ fontSize: "xs", color: "fg.muted" }),
  message: css({ fontSize: "sm", color: "fg.muted", whiteSpace: "pre-wrap", maxW: "md" }),
  actions: css({ display: "flex", gap: "2", justifyContent: "flex-end" }),
  link: css({ color: "accent.plain.fg", _hover: { textDecoration: "underline" } }),
}

/** After an answer: the lists, and the app's members (the approved user has a role now). */
const useAnswered = () => {
  const principal = usePrincipal()
  const queryClient = useQueryClient()
  return () => {
    const user = principal().user?.id
    if (user === undefined) return
    void queryClient.invalidateQueries({ queryKey: accessKeys.all(user) })
  }
}

const ApproveDialog = (props: { request: AccessRequest; onClose: () => void }) => {
  const answered = useAnswered()
  const about = useQuery(() => aboutQuery(props.request.app))
  const roles = () => (about.data?.app.roles ?? []).filter((role) => !role.stale)
  const [chosen, setChosen] = createSignal<string>()
  // What they asked for, else the smallest role.
  const role = () =>
    chosen() ?? roles().find((candidate) => candidate.id === props.request.role?.id)?.id ?? roles()[0]?.id

  const approve = useMutation(() => ({
    mutationFn: (roleId: string) =>
      platformApi((client) =>
        client.accessReview.approve({ params: { id: props.request.id }, payload: { role: roleId } }),
      ),
    onSuccess: (request: AccessRequest) => {
      toast.success(
        "Access given",
        `${request.userName} is now ${request.grantedRole?.name ?? "a member"} in ${request.appName}.`,
      )
      answered()
      props.onClose()
    },
    onError: (error: unknown) => toast.error("Could not approve the request", errorMessage(error)),
  }))

  return (
    <Modal
      open
      onOpenChange={(open) => !open && props.onClose()}
      title={`Give ${props.request.userName} access to ${props.request.appName}`}
      description="They get the role on top of the ones they have, and are notified."
      footer={
        <>
          <Button variant="outline" onClick={() => props.onClose()}>
            Cancel
          </Button>
          <Button
            disabled={role() === undefined}
            loading={approve.isPending}
            onClick={() => {
              const selected = role()
              if (selected !== undefined) approve.mutate(selected)
            }}
          >
            Give role
          </Button>
        </>
      }
    >
      <QueryBoundary query={about}>
        {(about) => (
          <div class={styles.stack}>
            <SelectField
              label="Role"
              items={roles().map((candidate) => ({ value: candidate.id, label: candidate.name }))}
              value={role()}
              onValueChange={setChosen}
            />
            <Show when={roles().find((candidate) => candidate.id === role())}>
              {(selected) => <RoleDetails role={selected()} appName={about().app.name} access={about().app.access} />}
            </Show>
          </div>
        )}
      </QueryBoundary>
    </Modal>
  )
}

const DeclineDialog = (props: { request: AccessRequest; onClose: () => void }) => {
  const answered = useAnswered()
  const [reason, setReason] = createSignal("")

  const decline = useMutation(() => ({
    mutationFn: () =>
      platformApi((client) =>
        client.accessReview.decline({ params: { id: props.request.id }, payload: { reason: reason().trim() || null } }),
      ),
    onSuccess: () => {
      toast.success("Request declined", `${props.request.userName} is notified.`)
      answered()
      props.onClose()
    },
    onError: (error: unknown) => toast.error("Could not decline the request", errorMessage(error)),
  }))

  return (
    <Modal
      open
      onOpenChange={(open) => !open && props.onClose()}
      title={`Decline ${props.request.userName}'s request`}
      description={`For ${props.request.appName}. They are notified, with your reason if you give one.`}
      footer={
        <>
          <Button variant="outline" onClick={() => props.onClose()}>
            Cancel
          </Button>
          <Button colorPalette="danger" loading={decline.isPending} onClick={() => decline.mutate()}>
            Decline
          </Button>
        </>
      }
    >
      <TextareaField label="Reason (optional)" value={reason()} onValueChange={setReason} maxLength={500} />
    </Modal>
  )
}

const Decision = (props: { request: AccessRequest }) => (
  <div class={styles.person}>
    <Switch>
      <Match when={props.request.status === "approved"}>
        <Badge variant="dot" colorPalette="success">
          {props.request.grantedRole?.name ?? "Approved"}
        </Badge>
      </Match>
      <Match when={props.request.status === "declined"}>
        <Badge variant="dot" colorPalette="danger">
          Declined
        </Badge>
      </Match>
    </Switch>
    <span class={styles.muted}>
      {props.request.decidedBy === null
        ? "Access was given another way"
        : `${props.request.decidedBy}${props.request.response === null ? "" : `: ${props.request.response}`}`}
    </span>
  </div>
)

const column = createColumnHelper<AccessRequest>()

/**
 * Requests for access the user may answer: of one app (on its page), or of every app they
 * manage. Waiting ones first; answered ones on their own tab.
 */
export const AccessRequests = (props: {
  /** Only this app's requests. */
  app?: string
  answered: boolean
  onAnsweredChange: (answered: boolean) => void
}) => {
  const principal = usePrincipal()
  const requests = useQuery(() => ({
    ...reviewsQuery(principal().user?.id ?? "", { app: props.app, status: props.answered ? undefined : "pending" }),
    enabled: principal().user !== null,
  }))
  const [approving, setApproving] = createSignal<AccessRequest>()
  const [declining, setDeclining] = createSignal<AccessRequest>()
  const rows = () => (requests.data ?? []).filter((request) => (request.status === "pending") !== props.answered)

  const columns = () =>
    column.columns([
      column.accessor("createdAt", {
        header: "Asked",
        cell: (info) => (
          <Tooltip content={formatDateTime(info.getValue())}>
            <span>{formatRelativeTime(info.getValue())}</span>
          </Tooltip>
        ),
      }),
      column.accessor("userName", {
        header: "Person",
        cell: (info) => (
          <div class={styles.person}>
            <span>{info.getValue()}</span>
            <span class={styles.muted}>{info.row.original.userEmail}</span>
          </div>
        ),
      }),
      ...(props.app === undefined
        ? [
            column.accessor("appName", {
              header: "App",
              cell: (info) => (
                <Link
                  to="/manage/$app"
                  params={{ app: info.row.original.app }}
                  search={{ tab: "requests" }}
                  class={styles.link}
                >
                  {info.getValue()}
                </Link>
              ),
            }),
          ]
        : []),
      column.accessor((request) => request.role?.name ?? "", {
        id: "role",
        header: "Role asked",
        cell: (info) => info.getValue() || "—",
      }),
      column.accessor("message", {
        header: "Message",
        enableSorting: false,
        cell: (info) => <span class={styles.message}>{info.getValue() ?? "—"}</span>,
      }),
      column.display({
        id: "decision",
        header: props.answered ? "Answer" : "",
        cell: (info) => (
          <Show when={info.row.original.status === "pending"} fallback={<Decision request={info.row.original} />}>
            <div class={styles.actions}>
              <Button size="xs" variant="outline" onClick={() => setDeclining(info.row.original)}>
                Decline…
              </Button>
              <Button size="xs" onClick={() => setApproving(info.row.original)}>
                Approve…
              </Button>
            </div>
          </Show>
        ),
      }),
    ])

  return (
    <div class={styles.stack}>
      <Tabs.Root
        value={props.answered ? "answered" : "pending"}
        onValueChange={({ value }) => props.onAnsweredChange(value === "answered")}
      >
        <Tabs.List>
          <For
            each={[
              { value: "pending", label: "Waiting" },
              { value: "answered", label: "Answered" },
            ]}
          >
            {(item) => <Tabs.Trigger value={item.value}>{item.label}</Tabs.Trigger>}
          </For>
          <Tabs.Indicator />
        </Tabs.List>
      </Tabs.Root>
      <QueryBoundary query={requests}>
        {() => (
          <Show
            when={rows().length > 0}
            fallback={
              <EmptyState
                icon={<Inbox size={32} />}
                title={props.answered ? "No answered requests" : "No requests waiting"}
                description="People ask for access from All apps, to apps they cannot open."
              />
            }
          >
            <DataTable columns={columns()} data={rows()} getRowId={(request) => String(request.id)} />
          </Show>
        )}
      </QueryBoundary>
      <Show when={approving()}>
        {(request) => <ApproveDialog request={request()} onClose={() => setApproving(undefined)} />}
      </Show>
      <Show when={declining()}>
        {(request) => <DeclineDialog request={request()} onClose={() => setDeclining(undefined)} />}
      </Show>
    </div>
  )
}
