import { Button, EmptyState } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { Link } from "@tanstack/solid-router"
import ShieldX from "lucide-solid/icons/shield-x"
import { type JSX, Show } from "solid-js"

/** Shown when a logged-in principal lacks the permission a page needs. */
export const AccessDenied = (props: {
  permission?: string
  /** Replaces the default explanation, e.g. whom to ask. */
  description?: JSX.Element
  /** Replaces the way back, e.g. a link to ask for access. */
  action?: JSX.Element
}) => (
  <div class={css({ py: "16" })}>
    <EmptyState
      icon={<ShieldX size={32} />}
      title="You don't have access to this page"
      description={
        props.description ?? (
          <Show when={props.permission} fallback="Ask an administrator to grant you access.">
            {(permission) => (
              <>
                Ask an administrator for the <code class={css({ fontFamily: "mono" })}>{permission()}</code> permission.
              </>
            )}
          </Show>
        )
      }
      action={
        props.action ?? (
          <Link to="/">
            <Button variant="outline">Back to Overview</Button>
          </Link>
        )
      }
    />
  </div>
)
