import type { AppRole } from "@mosaik/auth/contract"
import { css } from "@mosaik/styled-system/css"
import Check from "lucide-solid/icons/check"
import { For, Show } from "solid-js"

const styles = {
  details: css({ display: "flex", flexDirection: "column", gap: "1.5", fontSize: "sm" }),
  description: css({ color: "fg.muted" }),
  list: css({ display: "flex", flexDirection: "column", gap: "1" }),
  item: css({ display: "flex", alignItems: "flex-start", gap: "2", color: "fg.default" }),
  check: css({ flexShrink: "0", mt: "0.5", color: "success.text" }),
}

/** What a role lets people do, besides opening the app (which every app role does). */
export const RoleDetails = (props: { role: AppRole; appName: string; access: string }) => {
  const extras = () => props.role.permissions.filter((permission) => permission.key !== props.access)
  return (
    <div class={styles.details}>
      <Show when={props.role.description}>
        {(description) => <span class={styles.description}>{description()}</span>}
      </Show>
      <ul class={styles.list}>
        <li class={styles.item}>
          <Check size={14} class={styles.check} />
          Open {props.appName}
        </li>
        <For each={extras()}>
          {(permission) => (
            <li class={styles.item}>
              <Check size={14} class={styles.check} />
              {permission.description}
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}
