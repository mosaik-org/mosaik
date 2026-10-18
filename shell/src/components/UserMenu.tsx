import { signOut, usePrincipal } from "@mosaik/auth/web"
import { css } from "@mosaik/styled-system/css"
import { Avatar, Button, Menu, toast } from "@mosaik/ui"
import { useQueryClient } from "@tanstack/solid-query"
import { Link, useNavigate } from "@tanstack/solid-router"
import Bell from "lucide-solid/icons/bell"
import LogOut from "lucide-solid/icons/log-out"
import { Show } from "solid-js"

const trigger = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
  p: "1",
  pr: "2",
  borderRadius: "full",
  cursor: "pointer",
  _hover: { bg: "bg.muted" },
  _focusVisible: { outline: "2px solid", outlineColor: "accent.default" },
})

export const UserMenu = () => {
  const principal = usePrincipal()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const logout = async () => {
    try {
      await signOut()
    } catch {
      toast.error("Could not sign out")
      return
    }
    // Grants changed: drop everything cached for the previous principal.
    queryClient.clear()
    await navigate({ to: "/" })
  }

  return (
    <Show
      when={principal().user}
      fallback={
        <Link to="/login">
          <Button size="sm">Log in</Button>
        </Link>
      }
    >
      {(user) => (
        <Menu
          trigger={(props) => (
            <button type="button" class={trigger} {...props} aria-label="Account menu">
              <Avatar name={user().name} src={user().image} size="sm" />
              <span class={css({ fontSize: "sm", fontWeight: "medium", hideBelow: "sm" })}>{user().name}</span>
            </button>
          )}
          header={
            <div class={css({ px: "3", py: "2" })}>
              <div class={css({ fontWeight: "medium" })}>{user().name}</div>
              <div class={css({ fontSize: "xs", color: "fg.muted" })}>{user().email}</div>
            </div>
          }
          items={[
            {
              value: "notifications",
              label: "Notification settings",
              icon: <Bell size={16} />,
              onSelect: () => void navigate({ to: "/notifications/settings" }),
            },
            { value: "logout", label: "Sign out", icon: <LogOut size={16} />, onSelect: () => void logout() },
          ]}
        />
      )}
    </Show>
  )
}
