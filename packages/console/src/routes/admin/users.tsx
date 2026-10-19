import { type AdminUser, admin, CreateUser, type Role } from "@mosaik/auth/contract"
import { usePrincipal } from "@mosaik/auth/web"
import { errorMessage, formatDate } from "@mosaik/client"
import { css } from "@mosaik/styled-system/css"
import { createColumnHelper, DataTable } from "@mosaik/table"
import { Avatar, Badge, Button, ConfirmDialog, Dialog, IconButton, Menu, TextField, toast } from "@mosaik/ui"
import { QueryBoundary, useCommands } from "@mosaik/web-kit"
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query"
import { createFileRoute } from "@tanstack/solid-router"
import Ellipsis from "lucide-solid/icons/ellipsis"
import UserPlus from "lucide-solid/icons/user-plus"
import { createSignal, For, Show } from "solid-js"
import { RolePicker } from "../../admin/components/RolePicker"
import { adminKeys, rolesQuery, usersQuery } from "../../admin/queries"
import { roleLabel } from "../../admin/roles"
import { adminApi } from "../../api"

export const Route = createFileRoute("/_app/admin/users")({
  staticData: { title: "Users", keywords: ["accounts", "people"], permission: admin.perm("users.manage") },
  component: Users,
})

const PROVIDERS: Record<string, string> = { credential: "Password", microsoft: "Microsoft" }

const column = createColumnHelper<AdminUser>()

const useUserActions = () => {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: adminKeys.all })
  const onError = (error: unknown) => toast.error("Action failed", errorMessage(error))

  const setRoles = useMutation(() => ({
    mutationFn: (input: { user: AdminUser; roles: ReadonlyArray<string> }) =>
      adminApi((client) => client.users.setRoles({ params: { id: input.user.id }, payload: { roles: input.roles } })),
    onSuccess: (user) => {
      toast.success("Roles updated", user.email)
      void invalidate()
    },
    onError,
  }))

  const remove = useMutation(() => ({
    mutationFn: (user: AdminUser) => adminApi((client) => client.users.delete({ params: { id: user.id } })),
    onSuccess: () => {
      toast.success("User deleted")
      void invalidate()
    },
    onError,
  }))

  return { setRoles, remove }
}

const UserRowActions = (props: { user: AdminUser; roles: ReadonlyArray<Role> }) => {
  const principal = usePrincipal()
  const actions = useUserActions()
  const [editing, setEditing] = createSignal(false)
  const [deleting, setDeleting] = createSignal(false)
  const [selected, setSelected] = createSignal<ReadonlyArray<string>>([])

  const openEditor = () => {
    setSelected(props.user.roles)
    setEditing(true)
  }

  return (
    <>
      <Menu
        trigger={(triggerProps) => (
          <IconButton label={`Actions for ${props.user.email}`} size="sm" {...triggerProps}>
            <Ellipsis size={16} />
          </IconButton>
        )}
        items={[
          { value: "roles", label: "Edit roles…", onSelect: openEditor },
          {
            value: "delete",
            label: "Delete user…",
            danger: true,
            disabled: principal().user?.id === props.user.id,
            onSelect: () => setDeleting(true),
          },
        ]}
      />
      <Dialog
        open={editing()}
        onOpenChange={setEditing}
        title={`Roles of ${props.user.name}`}
        description="Every logged-in user also has the Authenticated role."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              loading={actions.setRoles.isPending}
              onClick={() =>
                actions.setRoles.mutate({ user: props.user, roles: selected() }, { onSuccess: () => setEditing(false) })
              }
            >
              Save
            </Button>
          </>
        }
      >
        <RolePicker roles={props.roles} value={selected()} onChange={setSelected} />
      </Dialog>
      <ConfirmDialog
        open={deleting()}
        onOpenChange={setDeleting}
        title={`Delete ${props.user.email}?`}
        description="The user is signed out everywhere and loses all access. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={actions.remove.isPending}
        onConfirm={() => actions.remove.mutate(props.user, { onSuccess: () => setDeleting(false) })}
      />
    </>
  )
}

const CreateUserDialog = (props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: ReadonlyArray<Role>
}) => {
  const queryClient = useQueryClient()
  const [name, setName] = createSignal("")
  const [email, setEmail] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [roles, setRoles] = createSignal<ReadonlyArray<string>>([])

  const create = useMutation(() => ({
    mutationFn: () =>
      adminApi((client) =>
        client.users.create({
          payload: new CreateUser({ name: name(), email: email(), password: password(), roles: roles() }),
        }),
      ),
    onSuccess: (user) => {
      toast.success("User created", user.email)
      void queryClient.invalidateQueries({ queryKey: adminKeys.all })
      setName("")
      setEmail("")
      setPassword("")
      setRoles([])
      props.onOpenChange(false)
    },
    onError: (error: unknown) => toast.error("Could not create user", errorMessage(error)),
  }))

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="New user"
      description="For people without a Microsoft account. SSO users are created on their first login."
      footer={
        <>
          <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-user" loading={create.isPending}>
            Create user
          </Button>
        </>
      }
    >
      <form
        id="create-user"
        class={css({ display: "flex", flexDirection: "column", gap: "4" })}
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate()
        }}
      >
        <TextField label="Name" required value={name()} onValueChange={setName} />
        <TextField label="Email" type="email" required value={email()} onValueChange={setEmail} />
        <TextField
          label="Initial password"
          type="password"
          autocomplete="new-password"
          required
          helperText="At least 8 characters. Share it securely."
          value={password()}
          onValueChange={setPassword}
        />
        <div>
          <div class={css({ fontSize: "sm", fontWeight: "medium", mb: "2" })}>Roles</div>
          <RolePicker roles={props.roles} value={roles()} onChange={setRoles} />
        </div>
      </form>
    </Dialog>
  )
}

function Users() {
  const users = useQuery(usersQuery)
  const roles = useQuery(rolesQuery)
  const [creating, setCreating] = createSignal(false)
  useCommands(() => [
    {
      id: "admin:users:create",
      title: "Create user",
      group: "Users",
      icon: <UserPlus size={16} />,
      perform: () => setCreating(true),
    },
  ])
  const roleName = (id: string) => {
    const role = roles.data?.find((candidate) => candidate.id === id)
    return role === undefined ? id : roleLabel(role)
  }

  const columns = column.columns([
    column.accessor("name", {
      header: "User",
      cell: (info) => (
        <div class={css({ display: "flex", alignItems: "center", gap: "3" })}>
          <Avatar name={info.row.original.name} src={info.row.original.image} size="sm" />
          <div>
            <div class={css({ fontWeight: "medium" })}>{info.row.original.name}</div>
            <div class={css({ fontSize: "xs", color: "fg.muted" })}>{info.row.original.email}</div>
          </div>
        </div>
      ),
    }),
    column.accessor("roles", {
      header: "Roles",
      enableSorting: false,
      cell: (info) => (
        <div class={css({ display: "flex", gap: "1", flexWrap: "wrap" })}>
          <For each={info.getValue()} fallback={<span class={css({ color: "fg.subtle" })}>—</span>}>
            {(role) => <Badge tone={role === "superadmin" ? "accent" : "neutral"}>{roleName(role)}</Badge>}
          </For>
        </div>
      ),
    }),
    column.accessor("providers", {
      header: "Sign-in",
      enableSorting: false,
      cell: (info) =>
        info
          .getValue()
          .map((provider) => PROVIDERS[provider] ?? provider)
          .join(", "),
    }),
    column.accessor("createdAt", { header: "Created", cell: (info) => formatDate(info.getValue()) }),
    column.display({
      id: "actions",
      header: "",
      meta: { align: "right", width: "56px" },
      cell: (info) => <UserRowActions user={info.row.original} roles={roles.data ?? []} />,
    }),
  ])

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
      <div class={css({ display: "flex", justifyContent: "flex-end" })}>
        <Button onClick={() => setCreating(true)}>
          <UserPlus size={16} />
          New user
        </Button>
      </div>
      <QueryBoundary query={users}>
        {(data) => (
          <DataTable columns={columns} data={data()} getRowId={(user) => user.id} loading={users.isFetching} />
        )}
      </QueryBoundary>
      <Show when={roles.data}>
        {(roles) => <CreateUserDialog open={creating()} onOpenChange={setCreating} roles={roles()} />}
      </Show>
    </div>
  )
}
