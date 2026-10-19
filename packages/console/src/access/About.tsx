import type { AppAbout } from "@mosaik/platform/contract"
import { css } from "@mosaik/styled-system/css"
import { Avatar, Badge, Card, CardHeader } from "@mosaik/ui"
import { For, Show } from "solid-js"
import { RoleDetails } from "./RoleDetails"

const styles = {
  roles: css({ display: "grid", gap: "4", gridTemplateColumns: { base: "1fr", md: "repeat(2, 1fr)" } }),
  role: css({ display: "flex", flexDirection: "column", gap: "2" }),
  roleName: css({ fontWeight: "semibold", display: "flex", gap: "2", alignItems: "center" }),
  people: css({ display: "flex", flexDirection: "column", gap: "3" }),
  person: css({ display: "flex", alignItems: "center", gap: "3", fontSize: "sm" }),
  muted: css({ fontSize: "sm", color: "fg.muted" }),
}

const whoCanUse = (about: AppAbout) =>
  about.openTo === "anonymous"
    ? "Everyone, even without logging in."
    : about.openTo === "authenticated"
      ? "Everyone who is logged in."
      : "People with one of its roles."

/** An app's roles, what each allows, and who can use it. */
export const AppRoles = (props: { readonly about: AppAbout }) => (
  <Card>
    <CardHeader title="Roles" description={`Who can use it: ${whoCanUse(props.about)}`} />
    <div class={styles.roles}>
      <For each={props.about.app.roles.filter((role) => !role.stale)}>
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
)

/** Whom to ask: the app's owners, or the administrators when it has none. */
export const AppOwners = (props: { readonly about: AppAbout }) => (
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
)
