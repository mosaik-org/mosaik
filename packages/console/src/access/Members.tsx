import type { AppMember, AppRole } from "@mosaik/auth/contract"
import { usePrincipal } from "@mosaik/auth/web"
import { errorMessage } from "@mosaik/client"
import type { PrincipalUser } from "@mosaik/core"
import type { AppAbout } from "@mosaik/platform/contract"
import { css } from "@mosaik/styled-system/css"
import { createColumnHelper, DataTable } from "@mosaik/table"
import { Avatar, Badge, Button, Checkbox, Dialog, EmptyState, Input, toast } from "@mosaik/ui"
import { createDebounced, QueryBoundary } from "@mosaik/web-kit"
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query"
import UserPlus from "lucide-solid/icons/user-plus"
import Users from "lucide-solid/icons/users"
import { createSignal, For, Show } from "solid-js"
import { platformApi } from "../api"
import { accessKeys, membersQuery } from "./queries"

const styles = {
  stack: css({ display: "flex", flexDirection: "column", gap: "4" }),
  toolbar: css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "3", flexWrap: "wrap" }),
  note: css({ fontSize: "sm", color: "fg.muted" }),
  person: css({ display: "flex", alignItems: "center", gap: "3", minW: "0" }),
  name: css({ fontWeight: "medium" }),
  muted: css({ fontSize: "xs", color: "fg.muted" }),
  badges: css({ display: "flex", gap: "1", flexWrap: "wrap" }),
  results: css({ display: "flex", flexDirection: "column", gap: "1", maxH: "64", overflowY: "auto" }),
  result: css({
    display: "flex",
    alignItems: "center",
    gap: "3",
    px: "2",
    py: "2",
    borderRadius: "md",
    textAlign: "left",
    cursor: "pointer",
    _hover: { bg: "bg.muted" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.default" },
  }),
  roles: css({ display: "flex", flexDirection: "column", gap: "3" }),
}

const Person = (props: { user: PrincipalUser }) => (
  <div class={styles.person}>
    <Avatar name={props.user.name} src={props.user.image} size="sm" />
    <div class={css({ minW: "0" })}>
      <div class={styles.name}>{props.user.name}</div>
      <div class={styles.muted}>{props.user.email}</div>
    </div>
  </div>
)

/** Gives a person roles in the app, or takes them away; their other roles stay. */
const RolesDialog = (props: {
  about: AppAbout
  user: PrincipalUser
  /** The app roles they have now. */
  current: ReadonlyArray<string>
  onClose: () => void
}) => {
  const principal = usePrincipal()
  const queryClient = useQueryClient()
  const [selected, setSelected] = createSignal<ReadonlyArray<string>>(props.current)
  // An app's old role is listed only for people who still have it.
  const roles = () => props.about.app.roles.filter((role) => !role.stale || props.current.includes(role.id))
  const ownerRole = () => props.about.app.roles.find((role) => role.isOwner)
  const removesOwnOwnership = () =>
    props.user.id === principal().user?.id &&
    ownerRole() !== undefined &&
    props.current.includes(ownerRole()?.id ?? "") &&
    !selected().includes(ownerRole()?.id ?? "")

  const save = useMutation(() => ({
    mutationFn: () =>
      platformApi((client) =>
        client.apps.setMemberRoles({
          params: { id: props.about.app.id, user: props.user.id },
          payload: { roles: selected() },
        }),
      ),
    onSuccess: () => {
      toast.success("Roles saved", props.user.name)
      const user = principal().user?.id
      if (user !== undefined) void queryClient.invalidateQueries({ queryKey: accessKeys.all(user) })
      void queryClient.invalidateQueries({ queryKey: accessKeys.about(props.about.app.id) })
      props.onClose()
    },
    onError: (error: unknown) => toast.error("Could not save the roles", errorMessage(error)),
  }))

  const toggle = (role: AppRole, checked: boolean) =>
    setSelected((current) => (checked ? [...current, role.id] : current.filter((id) => id !== role.id)))

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && props.onClose()}
      title={`${props.user.name} in ${props.about.app.name}`}
      description="Each role opens the app. Their roles elsewhere stay as they are."
      footer={
        <>
          <Button variant="outline" onClick={() => props.onClose()}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div class={styles.roles}>
        <For each={roles()}>
          {(role) => (
            <Checkbox
              checked={selected().includes(role.id)}
              onCheckedChange={(checked) => toggle(role, checked)}
              label={role.name}
              description={role.description ?? undefined}
            />
          )}
        </For>
        <Show when={removesOwnOwnership()}>
          <p class={styles.note}>You will no longer decide who can use {props.about.app.name}.</p>
        </Show>
      </div>
    </Dialog>
  )
}

/** Finds a person to give roles to. */
const AddPersonDialog = (props: { about: AppAbout; onPick: (user: PrincipalUser) => void; onClose: () => void }) => {
  const principal = usePrincipal()
  const [query, setQuery] = createSignal("")
  const term = createDebounced(() => query().trim(), 250)
  const people = useQuery(() => ({
    queryKey: accessKeys.people(principal().user?.id ?? "", props.about.app.id, term()),
    queryFn: () =>
      platformApi((client) => client.apps.people({ params: { id: props.about.app.id }, query: { q: term() } })),
    enabled: term().length >= 2,
  }))

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && props.onClose()}
      title={`Add someone to ${props.about.app.name}`}
      description="Search by name or e-mail, then choose their roles."
    >
      <div class={styles.stack}>
        <Input
          type="search"
          placeholder="Name or e-mail"
          aria-label="Name or e-mail"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          autofocus
        />
        <Show when={term().length >= 2}>
          <QueryBoundary query={people}>
            {(found) => (
              <div class={styles.results}>
                <For each={found()} fallback={<span class={styles.note}>Nobody found.</span>}>
                  {(user) => (
                    <button type="button" class={styles.result} onClick={() => props.onPick(user)}>
                      <Person user={user} />
                    </button>
                  )}
                </For>
              </div>
            )}
          </QueryBoundary>
        </Show>
      </div>
    </Dialog>
  )
}

const column = createColumnHelper<AppMember>()

/** The people who can use an app and how, for its owners and admins. */
export const Members = (props: { about: AppAbout }) => {
  const principal = usePrincipal()
  const members = useQuery(() => ({
    ...membersQuery(principal().user?.id ?? "", props.about.app.id),
    enabled: principal().user !== null,
  }))
  const [editing, setEditing] = createSignal<{ user: PrincipalUser; current: ReadonlyArray<string> }>()
  const [adding, setAdding] = createSignal(false)
  const roleName = (id: string) => props.about.app.roles.find((role) => role.id === id)?.name ?? id

  const columns = column.columns([
    column.accessor((member) => member.user.name, {
      id: "person",
      header: "Person",
      cell: (info) => <Person user={info.row.original.user} />,
    }),
    column.accessor("roles", {
      header: "Roles",
      enableSorting: false,
      cell: (info) => (
        <div class={styles.badges}>
          <For each={info.getValue()}>
            {(role) => (
              <Badge tone={role === props.about.app.roles.find((r) => r.isOwner)?.id ? "accent" : "neutral"}>
                {roleName(role)}
              </Badge>
            )}
          </For>
          <For each={info.row.original.via}>
            {(role) => (
              <span class={styles.muted} title="A role that names this app">
                through {role.name}
              </span>
            )}
          </For>
        </div>
      ),
    }),
    column.display({
      id: "actions",
      header: "",
      meta: { align: "right" },
      cell: (info) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing({ user: info.row.original.user, current: info.row.original.roles })}
        >
          Change roles…
        </Button>
      ),
    }),
  ])

  return (
    <div class={styles.stack}>
      <div class={styles.toolbar}>
        <span class={styles.note}>
          {props.about.openTo === "anonymous"
            ? `Everyone can open ${props.about.app.name}, even without logging in. Roles give more than that.`
            : props.about.openTo === "authenticated"
              ? `Everyone who is logged in can open ${props.about.app.name}. Roles give more than that.`
              : `Only the people below can open ${props.about.app.name} (and administrators).`}
        </span>
        <Button onClick={() => setAdding(true)}>
          <UserPlus size={16} /> Add someone
        </Button>
      </div>
      <QueryBoundary query={members}>
        {(list) => (
          <Show
            when={list().length > 0}
            fallback={
              <EmptyState
                icon={<Users size={32} />}
                title="Nobody has a role yet"
                description={`Add the people who use ${props.about.app.name}, or answer their requests.`}
              />
            }
          >
            <DataTable columns={columns} data={list()} getRowId={(member) => member.user.id} />
          </Show>
        )}
      </QueryBoundary>
      <Show when={adding()}>
        <AddPersonDialog
          about={props.about}
          onClose={() => setAdding(false)}
          onPick={(user) => {
            setAdding(false)
            const existing = members.data?.find((member) => member.user.id === user.id)
            setEditing({ user, current: existing?.roles ?? [] })
          }}
        />
      </Show>
      <Show when={editing()}>
        {(target) => (
          <RolesDialog
            about={props.about}
            user={target().user}
            current={target().current}
            onClose={() => setEditing(undefined)}
          />
        )}
      </Show>
    </div>
  )
}
