import type { CatalogApp } from "@mosaik/auth/contract"
import { grantCovers } from "@mosaik/core"
import { Badge, Card, CheckboxField, SwitchField } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { For, Show } from "solid-js"

export interface PermissionEditorProps {
  readonly catalog: ReadonlyArray<CatalogApp>
  readonly grants: ReadonlyArray<string>
  readonly onChange: (grants: ReadonlyArray<string>) => void
  readonly readOnly?: boolean
}

const wildcardOf = (app: CatalogApp) => `${app.id}:*`

const styles = {
  section: css({ display: "flex", flexDirection: "column", gap: "3" }),
  head: css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4", flexWrap: "wrap" }),
  title: css({ fontWeight: "semibold" }),
  list: css({ display: "grid", gap: "3", gridTemplateColumns: { base: "1fr", md: "repeat(2, 1fr)" } }),
  key: css({ fontFamily: "mono", fontSize: "xs", color: "fg.subtle" }),
}

/**
 * Edits a role's grants, grouped by app. Supports app wildcards
 * (`sales:*`); permissions implied by a wildcard are shown checked and locked.
 * Grants that are not shown here (e.g. `*` or `sales:orders.*`) are preserved.
 */
export const PermissionEditor = (props: PermissionEditorProps) => {
  const has = (grant: string) => props.grants.includes(grant)
  const implied = (key: string) => props.grants.some((grant) => grant !== key && grantCovers(grant, key))

  const set = (grant: string, enabled: boolean) =>
    props.onChange(enabled ? [...props.grants, grant] : props.grants.filter((g) => g !== grant))

  const setWildcard = (app: CatalogApp, enabled: boolean) => {
    const prefix = `${app.id}:`
    // Individual grants become redundant under the wildcard.
    const rest = props.grants.filter((grant) => !grant.startsWith(prefix))
    props.onChange(enabled ? [...rest, wildcardOf(app)] : rest)
  }

  const known = () => new Set(props.catalog.flatMap((app) => [wildcardOf(app), ...app.permissions.map((p) => p.key)]))
  const others = () => props.grants.filter((grant) => !known().has(grant))

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
      <Show when={others().length > 0}>
        <Card.Root>
          <Card.Body gap="4">
            <div class={styles.section}>
              <div class={styles.title}>Other grants</div>
              <div class={css({ display: "flex", gap: "2", flexWrap: "wrap" })}>
                <For each={others()}>{(grant) => <Badge>{grant === "*" ? "Everything (*)" : grant}</Badge>}</For>
              </div>
            </div>
          </Card.Body>
        </Card.Root>
      </Show>
      <For each={props.catalog}>
        {(app) => (
          <Card.Root>
            <Card.Body gap="4">
              <div class={styles.section}>
                <div class={styles.head}>
                  <div>
                    <div class={styles.title}>{app.name}</div>
                    <div class={styles.key}>{app.id}</div>
                  </div>
                  <SwitchField
                    label="All permissions"
                    checked={has(wildcardOf(app)) || implied(wildcardOf(app))}
                    disabled={props.readOnly || implied(wildcardOf(app))}
                    onCheckedChange={(checked) => setWildcard(app, checked)}
                  />
                </div>
                <div class={styles.list}>
                  <For each={app.permissions}>
                    {(permission) => (
                      <CheckboxField
                        checked={has(permission.key) || implied(permission.key)}
                        disabled={props.readOnly || implied(permission.key)}
                        onCheckedChange={(checked) => set(permission.key, checked)}
                        label={
                          <span
                            class={css({ display: "inline-flex", gap: "2", alignItems: "center", flexWrap: "wrap" })}
                          >
                            {permission.description}
                            <Show when={permission.key === app.access}>
                              <Badge>access</Badge>
                            </Show>
                            <Show when={permission.dangerous}>
                              <Badge colorPalette="danger">sensitive</Badge>
                            </Show>
                            <Show when={permission.stale}>
                              <Badge colorPalette="warning">no longer declared</Badge>
                            </Show>
                          </span>
                        }
                        helperText={<span class={styles.key}>{permission.key}</span>}
                      />
                    )}
                  </For>
                </div>
              </div>
            </Card.Body>
          </Card.Root>
        )}
      </For>
    </div>
  )
}
