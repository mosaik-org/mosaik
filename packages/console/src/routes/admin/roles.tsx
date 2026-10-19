import { admin, type CatalogApp, CreateRole, type Role } from "@mosaik/auth/contract"
import { useCan } from "@mosaik/auth/web"
import { errorMessage } from "@mosaik/client"
import { BuiltInRoles } from "@mosaik/core"
import { css } from "@mosaik/styled-system/css"
import { Badge, Button, Card, ConfirmDialog, Dialog, Input, TextField, toast } from "@mosaik/ui"
import { QueryBoundary } from "@mosaik/web-kit"
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query"
import { createFileRoute } from "@tanstack/solid-router"
import Plus from "lucide-solid/icons/plus"
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js"
import { PermissionEditor } from "../../admin/components/PermissionEditor"
import { adminKeys, catalogQuery, rolesQuery } from "../../admin/queries"
import { groupAppRoles, roleLabel } from "../../admin/roles"
import { adminApi } from "../../api"

export const Route = createFileRoute("/_app/admin/roles")({
  staticData: { title: "Roles & permissions", keywords: ["access", "grants", "rbac"] },
  component: Roles,
})

const styles = {
  layout: css({
    display: "grid",
    gap: "6",
    gridTemplateColumns: { base: "1fr", lg: "280px 1fr" },
    alignItems: "start",
  }),
  list: css({ display: "flex", flexDirection: "column", gap: "1" }),
  item: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "0.5",
    px: "3",
    py: "2.5",
    borderRadius: "md",
    textAlign: "left",
    cursor: "pointer",
    _hover: { bg: "bg.muted" },
    "&[aria-current=true]": { bg: "accent.subtle", color: "accent.text" },
  }),
  meta: css({ fontSize: "xs", color: "fg.muted" }),
  heading: css({ px: "3", pt: "3", pb: "1", fontSize: "xs", fontWeight: "semibold", color: "fg.muted" }),
  appName: css({ px: "3", pt: "2", fontSize: "sm", fontWeight: "medium" }),
  note: css({ fontSize: "sm", color: "fg.muted" }),
  hint: css({ px: "3", py: "2", fontSize: "sm", color: "fg.muted" }),
  toolbar: css({ display: "flex", alignItems: "center", gap: "3", flexWrap: "wrap" }),
}

/** Up to this many apps, every app is listed; above it, a search narrows the list. */
const LIST_ALL_APPS = 6

const matches = (term: string, ...texts: ReadonlyArray<string>) =>
  texts.some((text) => text.toLowerCase().includes(term))

const sameGrants = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length && a.every((grant) => b.includes(grant))

const roleSummary = (role: Role) =>
  role.id === BuiltInRoles.anonymous
    ? "Everyone, including logged-out visitors"
    : role.id === BuiltInRoles.authenticated
      ? "Every logged-in user"
      : `${role.userCount} ${role.userCount === 1 ? "user" : "users"}${role.stale ? " · no longer in the app" : ""}`

const CreateRoleDialog = (props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (role: Role) => void
}) => {
  const queryClient = useQueryClient()
  const [name, setName] = createSignal("")
  const [id, setId] = createSignal("")
  const [description, setDescription] = createSignal("")
  const slug = () =>
    id() ||
    name()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")

  const create = useMutation(() => ({
    mutationFn: () =>
      adminApi((client) =>
        client.roles.create({
          payload: new CreateRole({ id: slug(), name: name().trim(), description: description().trim() || null }),
        }),
      ),
    onSuccess: (role) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.roles })
      toast.success("Role created", role.name)
      setName("")
      setId("")
      setDescription("")
      props.onOpenChange(false)
      props.onCreated(role)
    },
    onError: (error: unknown) => toast.error("Could not create role", errorMessage(error)),
  }))

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="New role"
      footer={
        <>
          <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-role" loading={create.isPending}>
            Create role
          </Button>
        </>
      }
    >
      <form
        id="create-role"
        class={css({ display: "flex", flexDirection: "column", gap: "4" })}
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate()
        }}
      >
        <TextField label="Name" required value={name()} onValueChange={setName} placeholder="e.g. Sales managers" />
        <TextField
          label="Identifier"
          value={slug()}
          onValueChange={setId}
          helperText="Lowercase letters, digits and dashes."
        />
        <TextField label="Description" value={description()} onValueChange={setDescription} />
      </form>
    </Dialog>
  )
}

function Roles() {
  const can = useCan()
  const queryClient = useQueryClient()
  const roles = useQuery(rolesQuery)
  const catalog = useQuery(catalogQuery)
  const canManage = () => can(admin.perm("roles.manage"))

  const [selectedId, setSelectedId] = createSignal<string>(BuiltInRoles.authenticated)
  const [draft, setDraft] = createSignal<ReadonlyArray<string>>([])
  const [creating, setCreating] = createSignal(false)
  const [deleting, setDeleting] = createSignal(false)
  const [appQuery, setAppQuery] = createSignal("")
  const [catalogQueryText, setCatalogQueryText] = createSignal("")

  const selected = createMemo(() => roles.data?.find((role) => role.id === selectedId()))
  const customRoles = () => (roles.data ?? []).filter((role) => role.app === null)
  const apps = createMemo(() => groupAppRoles(roles.data ?? []))
  const shownApps = createMemo(() => {
    const term = appQuery().trim().toLowerCase()
    if (term === "" && apps().length <= LIST_ALL_APPS) return apps()
    // The selected role's app stays listed.
    return apps().filter(
      (app) =>
        app.id === selected()?.app ||
        (term !== "" && (matches(term, app.name, app.id) || app.roles.some((role) => matches(term, role.name)))),
    )
  })
  /** What the editor shows: an app role's own app; for other roles, the apps they have grants in or a search finds. */
  const editorCatalog = (role: Role, catalog: ReadonlyArray<CatalogApp>) => {
    if (role.app !== null) return catalog.filter((app) => app.id === role.app)
    const term = catalogQueryText().trim().toLowerCase()
    if (term === "" && catalog.length <= LIST_ALL_APPS) return catalog
    return catalog.filter(
      (app) =>
        draft().some((grant) => grant.startsWith(`${app.id}:`)) || (term !== "" && matches(term, app.name, app.id)),
    )
  }
  const dirty = () => {
    const role = selected()
    return role !== undefined && !sameGrants(role.grants, draft())
  }

  // Reset the draft whenever another role is selected or the saved grants change.
  createEffect(
    on(
      () => selected()?.grants,
      (grants) => setDraft(grants ?? []),
    ),
  )

  const invalidate = () => queryClient.invalidateQueries({ queryKey: adminKeys.roles })

  const save = useMutation(() => ({
    mutationFn: (input: { id: string; grants: ReadonlyArray<string> }) =>
      adminApi((client) => client.roles.setGrants({ params: { id: input.id }, payload: { grants: input.grants } })),
    onSuccess: (role) => {
      toast.success("Permissions saved", `${role.name}. Changes apply within a minute.`)
      void invalidate()
    },
    onError: (error: unknown) => toast.error("Could not save permissions", errorMessage(error)),
  }))

  const remove = useMutation(() => ({
    mutationFn: (id: string) => adminApi((client) => client.roles.delete({ params: { id } })),
    onSuccess: () => {
      toast.success("Role deleted")
      setDeleting(false)
      setSelectedId(BuiltInRoles.authenticated)
      void queryClient.invalidateQueries({ queryKey: adminKeys.all })
    },
    onError: (error: unknown) => toast.error("Could not delete role", errorMessage(error)),
  }))

  const roleItem = (role: Role) => (
    <button
      type="button"
      class={styles.item}
      aria-current={role.id === selectedId()}
      onClick={() => setSelectedId(role.id)}
    >
      <span class={css({ fontWeight: "medium", display: "flex", gap: "2", alignItems: "center" })}>
        {role.name}
        <Show when={role.builtIn}>
          <Badge>built-in</Badge>
        </Show>
      </span>
      <span class={styles.meta}>{roleSummary(role)}</span>
    </button>
  )

  return (
    <QueryBoundary query={roles}>
      {() => (
        <div class={styles.layout}>
          <Card padding="none">
            <div class={css({ p: "2" })}>
              <div class={styles.list}>
                <For each={customRoles()}>{(role) => roleItem(role)}</For>
              </div>
              <Show when={apps().length > 0}>
                <div class={styles.heading}>App roles</div>
                <Show when={apps().length > LIST_ALL_APPS}>
                  <div class={css({ px: "2", py: "1" })}>
                    <Input
                      type="search"
                      placeholder={`Find one of ${apps().length} apps`}
                      aria-label="Find an app"
                      value={appQuery()}
                      onInput={(event) => setAppQuery(event.currentTarget.value)}
                    />
                  </div>
                </Show>
                <For each={shownApps()} fallback={<p class={styles.hint}>Find an app to see its roles.</p>}>
                  {(app) => (
                    <div class={styles.list}>
                      <div class={styles.appName}>{app.name}</div>
                      <For each={app.roles}>{(role) => roleItem(role)}</For>
                    </div>
                  )}
                </For>
              </Show>
              <Show when={canManage()}>
                <div class={css({ p: "2", borderTopWidth: "1px", mt: "2" })}>
                  <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
                    <Plus size={16} />
                    New role
                  </Button>
                </div>
              </Show>
            </div>
          </Card>

          <Show when={selected()}>
            {(role) => (
              <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
                <div class={styles.toolbar}>
                  <div class={css({ flex: "1" })}>
                    <div class={css({ fontSize: "lg", fontWeight: "semibold" })}>{roleLabel(role())}</div>
                    <div class={styles.meta}>{role().description}</div>
                  </div>
                  <Show when={canManage() && !role().builtIn && (role().app === null || role().stale)}>
                    <Button variant="ghost" onClick={() => setDeleting(true)}>
                      Delete role
                    </Button>
                  </Show>
                  <Show when={canManage() && role().id !== BuiltInRoles.superadmin && role().app === null}>
                    <Button variant="outline" disabled={!dirty()} onClick={() => setDraft(role().grants)}>
                      Discard
                    </Button>
                    <Button
                      disabled={!dirty()}
                      loading={save.isPending}
                      onClick={() => save.mutate({ id: role().id, grants: draft() })}
                    >
                      Save changes
                    </Button>
                  </Show>
                </div>
                <Show when={role().app !== null}>
                  <p class={styles.note}>
                    {role().stale
                      ? `${role().appName} no longer has this role. Its ${role().userCount} users keep its permissions until you delete it.`
                      : `${role().appName} defines this role and its permissions. Its owners and user admins give it to people.`}
                  </p>
                </Show>
                <QueryBoundary query={catalog}>
                  {(apps) => (
                    <>
                      <Show when={role().app === null && apps().length > LIST_ALL_APPS}>
                        <Input
                          type="search"
                          placeholder={`Show more of ${apps().length} apps`}
                          aria-label="Find an app's permissions"
                          value={catalogQueryText()}
                          onInput={(event) => setCatalogQueryText(event.currentTarget.value)}
                        />
                      </Show>
                      <PermissionEditor
                        catalog={editorCatalog(role(), apps())}
                        grants={draft()}
                        onChange={setDraft}
                        readOnly={!canManage() || role().id === BuiltInRoles.superadmin || role().app !== null}
                      />
                    </>
                  )}
                </QueryBoundary>
                <ConfirmDialog
                  open={deleting()}
                  onOpenChange={setDeleting}
                  title={`Delete the ${roleLabel(role())} role?`}
                  description={`${role().userCount} users lose the permissions granted by this role.`}
                  confirmLabel="Delete"
                  tone="danger"
                  loading={remove.isPending}
                  onConfirm={() => remove.mutate(role().id)}
                />
              </div>
            )}
          </Show>
          <CreateRoleDialog open={creating()} onOpenChange={setCreating} onCreated={(role) => setSelectedId(role.id)} />
        </div>
      )}
    </QueryBoundary>
  )
}
