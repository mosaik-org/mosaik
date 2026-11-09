import { css } from "@mosaik/styled-system/css"
import { Button, EmptyState } from "@mosaik/ui"
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
  <EmptyState.Root py="16">
    <EmptyState.Indicator>
      <ShieldX />
    </EmptyState.Indicator>
    <EmptyState.Content>
      <EmptyState.Title>You don't have access to this page</EmptyState.Title>
      <EmptyState.Description>
        {props.description ?? (
          <Show when={props.permission} fallback="Ask an administrator to grant you access.">
            {(permission) => (
              <>
                Ask an administrator for the <code class={css({ fontFamily: "mono" })}>{permission()}</code> permission.
              </>
            )}
          </Show>
        )}
      </EmptyState.Description>
    </EmptyState.Content>
    <EmptyState.Actions>
      {props.action ?? (
        <Button
          variant="outline"
          asChild={(link) => (
            <Link to="/" {...link()}>
              Back to Overview
            </Link>
          )}
        />
      )}
    </EmptyState.Actions>
  </EmptyState.Root>
)
