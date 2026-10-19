import type { Role } from "@mosaik/auth/contract"
import { BuiltInRoles } from "@mosaik/core"
import { CheckboxField, Input } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { createMemo, createSignal, For, Show } from "solid-js"
import { type AppRoles, groupAppRoles } from "../roles"

const IMPLICIT = new Set<string>([BuiltInRoles.anonymous, BuiltInRoles.authenticated])

/** Up to this many apps, all their roles are listed; above it, a search finds them. */
const LIST_ALL_APPS = 6

const styles = {
  picker: css({ display: "flex", flexDirection: "column", gap: "5" }),
  section: css({ display: "flex", flexDirection: "column", gap: "3" }),
  heading: css({ fontSize: "xs", fontWeight: "semibold", color: "fg.muted", textTransform: "uppercase" }),
  app: css({ display: "flex", flexDirection: "column", gap: "2", pl: "1" }),
  appName: css({ fontSize: "sm", fontWeight: "medium" }),
  hint: css({ fontSize: "sm", color: "fg.muted" }),
}

/**
 * Checkboxes for the roles a user can be given: the ones admins created, then each app's
 * own. With many apps, only those the user has roles in are listed until a search
 * finds others. Implicit built-in roles are never assigned.
 */
export const RolePicker = (props: {
  roles: ReadonlyArray<Role>
  value: ReadonlyArray<string>
  onChange: (roles: ReadonlyArray<string>) => void
}) => {
  const [query, setQuery] = createSignal("")
  const custom = () => props.roles.filter((role) => role.app === null && !IMPLICIT.has(role.id))
  const apps = createMemo(() => groupAppRoles(props.roles))
  const has = (id: string) => props.value.includes(id)
  const toggle = (id: string, checked: boolean) =>
    props.onChange(checked ? [...props.value, id] : props.value.filter((role) => role !== id))

  const shownApps = createMemo((): ReadonlyArray<AppRoles> => {
    const term = query().trim().toLowerCase()
    if (term === "" && apps().length <= LIST_ALL_APPS) return apps()
    return apps().filter(
      (app) =>
        app.roles.some((role) => has(role.id)) ||
        (term !== "" && (app.name.toLowerCase().includes(term) || app.id.includes(term))),
    )
  })

  const checkbox = (role: Role) => (
    <CheckboxField
      checked={has(role.id)}
      onCheckedChange={(checked) => toggle(role.id, checked)}
      label={role.name}
      helperText={role.description ?? undefined}
    />
  )

  return (
    <div class={styles.picker}>
      <div class={styles.section}>
        <For each={custom()}>{checkbox}</For>
      </div>
      <Show when={apps().length > 0}>
        <div class={styles.section}>
          <div class={styles.heading}>App roles</div>
          <Show when={apps().length > LIST_ALL_APPS}>
            <Input
              type="search"
              placeholder={`Find one of ${apps().length} apps`}
              aria-label="Find an app"
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
            />
          </Show>
          <For
            each={shownApps()}
            fallback={<span class={styles.hint}>No app roles yet. Search for an app to give one.</span>}
          >
            {(app) => (
              <div class={styles.app}>
                <span class={styles.appName}>{app.name}</span>
                {/* An app's old role stays listed only for people who still have it. */}
                <For each={app.roles.filter((role) => !role.stale || has(role.id))}>{checkbox}</For>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
