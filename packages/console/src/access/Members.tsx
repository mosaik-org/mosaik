import type { AppMember, AppRole } from "@mosaik/auth/contract"
import { usePrincipal } from "@mosaik/auth/web"
import { errorMessage, toast } from "@mosaik/client"
import { createDebounced } from "@mosaik/client/solid"
import type { PrincipalUser } from "@mosaik/core"
import type { AppAbout } from "@mosaik/platform/contract"
import { css } from "@mosaik/styled-system/css"
import { createColumnHelper, DataTable } from "@mosaik/table"
import {
  Badge,
  Button,
  CheckboxField,
  Combobox,
  createListCollection,
  EmptyState,
  Modal,
  Spinner,
  Tooltip,
} from "@mosaik/ui"
import { QueryBoundary, UserAvatar } from "@mosaik/web-kit"
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query"
import UserPlus from "lucide-solid/icons/user-plus"
import Users from "lucide-solid/icons/users"
import { createMemo, createSignal, For, Show } from "solid-js"
import { Portal } from "solid-js/web"
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
  // A person is two lines: their option grows with them, with room above and below.
  option: css({ py: "1.5" }),
  roles: css({ display: "flex", flexDirection: "column", gap: "3" }),
}

const Person = (props: { user: PrincipalUser }) => (
  <div class={styles.person}>
    <UserAvatar user={props.user} size="sm" />
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
    <Modal
      open
      onOpenChange={(details) => !details.open && props.onClose()}
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
            <CheckboxField
              checked={selected().includes(role.id)}
              onCheckedChange={(checked) => toggle(role, checked)}
              label={role.name}
              helperText={role.description ?? undefined}
            />
          )}
        </For>
        <Show when={removesOwnOwnership()}>
          <p class={styles.note}>You will no longer decide who can use {props.about.app.name}.</p>
        </Show>
      </div>
    </Modal>
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
  // The people found, as the combobox's options: the server searched, so nothing is filtered here.
  const found = createMemo(() =>
    createListCollection<PrincipalUser>({
      items: term().length >= 2 ? [...(people.data ?? [])] : [],
      itemToString: (user) => user.name,
      itemToValue: (user) => user.id,
    }),
  )

  return (
    <Modal
      open
      onOpenChange={(details) => !details.open && props.onClose()}
      title={`Add someone to ${props.about.app.name}`}
      description="Search by name or e-mail, then choose their roles."
    >
      {/* A combobox: people found as the name is typed, chosen with the pointer or the keyboard. */}
      <Combobox.Root
        collection={found()}
        openOnClick
        onInputValueChange={(details) => setQuery(details.inputValue)}
        onValueChange={(details) => {
          const user = details.items[0]
          if (user !== undefined) props.onPick(user)
        }}
      >
        <Combobox.Control>
          <Combobox.Input placeholder="Name or e-mail" aria-label="Name or e-mail" autofocus />
          <Show when={people.isFetching}>
            <Spinner size="xs" label="Searching" />
          </Show>
        </Combobox.Control>
        <Portal>
          <Combobox.Positioner>
            <Combobox.Content>
              <Combobox.Empty>
                <span class={styles.note}>
                  {term().length < 2
                    ? "Type at least two letters."
                    : people.isError
                      ? `Could not search: ${errorMessage(people.error)}`
                      : "Nobody found."}
                </span>
              </Combobox.Empty>
              <For each={found().items}>
                {(user) => (
                  <Combobox.Item item={user} class={styles.option}>
                    <Person user={user} />
                  </Combobox.Item>
                )}
              </For>
            </Combobox.Content>
          </Combobox.Positioner>
        </Portal>
      </Combobox.Root>
    </Modal>
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
          <For each={info.getValue()}>{(role) => <Badge>{roleName(role)}</Badge>}</For>
          <For each={info.row.original.via}>
            {(role) => (
              <Tooltip.Root>
                <Tooltip.Trigger
                  asChild={(trigger) => (
                    <span class={styles.muted} {...trigger()}>
                      through {role.name}
                    </span>
                  )}
                />
                {/* Out of the table, which clips what overflows it. */}
                <Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Content>A role that names this app</Tooltip.Content>
                  </Tooltip.Positioner>
                </Portal>
              </Tooltip.Root>
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
          size="xs"
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
              <EmptyState.Root>
                <EmptyState.Indicator>
                  <Users />
                </EmptyState.Indicator>
                <EmptyState.Content>
                  <EmptyState.Title>Nobody has a role yet</EmptyState.Title>
                  <EmptyState.Description>
                    Add the people who use {props.about.app.name}, or answer their requests.
                  </EmptyState.Description>
                </EmptyState.Content>
              </EmptyState.Root>
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
