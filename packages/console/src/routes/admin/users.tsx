import { type AdminUser, admin, CreateUser, type Role } from "@mosaik/auth/contract"
import { usePrincipal } from "@mosaik/auth/web"
import { formatDate } from "@mosaik/client"
import {
  ActionMenu,
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  IconButton,
  Modal,
  PasswordField,
  TextField,
} from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { createColumnHelper, DataTable } from "@mosaik/table"
import { createForm, QueryBoundary, useAction, useCommands } from "@mosaik/web-kit"
import { useQuery } from "@tanstack/solid-query"
import { createFileRoute } from "@tanstack/solid-router"
import Ellipsis from "lucide-solid/icons/ellipsis"
import UserPlus from "lucide-solid/icons/user-plus"
import { createSignal, For, Show } from "solid-js"
import { RolePicker } from "../../admin/components/RolePicker"
import { rolesQuery, usersQuery } from "../../admin/queries"
import { roleLabel } from "../../admin/roles"
import { administration } from "../../api"

export const Route = createFileRoute("/_app/admin/users")({
  staticData: { title: "Users", keywords: ["accounts", "people"], permission: admin.perm("users.manage") },
  component: Users,
})

const PROVIDERS: Record<string, string> = { credential: "Password", microsoft: "Microsoft" }

const column = createColumnHelper<AdminUser>()

const useUserActions = () => ({
  setRoles: useAction(administration.users.setRoles, {
    success: (user) => `Roles of ${user.email} updated`,
    invalidates: [administration],
  }),
  remove: useAction(administration.users.delete, { success: "User deleted", invalidates: [administration] }),
})

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
      <ActionMenu
        trigger={(triggerProps) => (
          <IconButton variant="plain" aria-label={`Actions for ${props.user.email}`} size="2xs" {...triggerProps()}>
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
      <Modal
        open={editing()}
        onOpenChange={setEditing}
        title={`Roles of ${props.user.name}`}
        description="Every logged-in user also has the Authenticated role."
        footer={
          <>
            <Button variant="plain" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              loading={actions.setRoles.pending()}
              onClick={async () => {
                if (await actions.setRoles.run({ params: { id: props.user.id }, payload: { roles: selected() } })) {
                  setEditing(false)
                }
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <RolePicker roles={props.roles} value={selected()} onChange={setSelected} />
      </Modal>
      <ConfirmDialog
        open={deleting()}
        onOpenChange={setDeleting}
        title={`Delete ${props.user.email}?`}
        description="The user is signed out everywhere and loses all access. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={actions.remove.pending()}
        onConfirm={async () => {
          if (await actions.remove.run({ params: { id: props.user.id } })) setDeleting(false)
        }}
      />
    </>
  )
}

const CreateUserDialog = (props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: ReadonlyArray<Role>
}) => {
  const create = useAction(administration.users.create, {
    success: (user) => `${user.email} was created`,
    invalidates: [administration],
  })
  // The API's own payload Schema: the dialog checks what the server will (an e-mail, 8 characters...).
  const form = createForm({
    schema: CreateUser,
    initial: { name: "", email: "", password: "", roles: [] },
    onSubmit: async (payload) => {
      await create.submit({ payload })
      form.reset()
      props.onOpenChange(false)
    },
  })

  return (
    <Modal
      open={props.open}
      onOpenChange={(open) => {
        if (!open) form.reset()
        props.onOpenChange(open)
      }}
      title="New user"
      description="For people without a Microsoft account. SSO users are created on their first login."
      footer={
        <>
          <Button variant="plain" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-user" loading={form.submitting()}>
            Create user
          </Button>
        </>
      }
    >
      <form
        id="create-user"
        noValidate
        class={css({ display: "flex", flexDirection: "column", gap: "4" })}
        onSubmit={form.submit}
      >
        <TextField label="Name" required {...form.field("name")} />
        <TextField label="Email" type="email" required {...form.field("email")} />
        <PasswordField
          label="Initial password"
          autocomplete="new-password"
          required
          helperText="At least 8 characters. Share it securely."
          {...form.field("password")}
        />
        <div>
          <div class={css({ fontSize: "sm", fontWeight: "medium", mb: "2" })}>Roles</div>
          <RolePicker roles={props.roles} value={form.values.roles} onChange={(roles) => form.set("roles", roles)} />
        </div>
        <Show when={form.error()}>
          {(error) => (
            <p role="alert" class={css({ color: "danger.plain.fg", fontSize: "sm" })}>
              {error()}
            </p>
          )}
        </Show>
      </form>
    </Modal>
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
          <Avatar.Root size="sm">
            <Avatar.Fallback name={info.row.original.name} />
            <Avatar.Image src={info.row.original.image ?? undefined} />
          </Avatar.Root>
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
            {(role) => <Badge colorPalette={role === "superadmin" ? "accent" : "neutral"}>{roleName(role)}</Badge>}
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
