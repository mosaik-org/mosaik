import { AGENT_CONNECTIONS_PATH, signInUrl } from "@mosaik/auth/contract"
import { signOut, usePrincipal } from "@mosaik/auth/web"
import { toast } from "@mosaik/client"
import { ActionMenu, Avatar, Button, ThemeChoice, ThemeToggle } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { useQueryClient } from "@tanstack/solid-query"
import { useNavigate } from "@tanstack/solid-router"
import Bell from "lucide-solid/icons/bell"
import Bot from "lucide-solid/icons/bot"
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
  _hover: { bg: "gray.subtle.bg" },
  _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg" },
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
        // No account menu to choose the theme in.
        <>
          <ThemeToggle />
          <a href={signInUrl(`${location.pathname}${location.search}`)}>
            <Button size="xs">Log in</Button>
          </a>
        </>
      }
    >
      {(user) => (
        <ActionMenu
          trigger={(props) => (
            <button type="button" {...props()} class={trigger} aria-label="Account menu">
              <Avatar.Root size="sm">
                <Avatar.Fallback name={user().name} />
                <Avatar.Image src={user().image ?? undefined} />
              </Avatar.Root>
              <span class={css({ fontSize: "sm", fontWeight: "medium", hideBelow: "sm" })}>{user().name}</span>
            </button>
          )}
          header={
            <div class={css({ py: "2" })}>
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
            {
              value: "agents",
              label: "AI clients",
              icon: <Bot size={16} />,
              // Core's own page, outside the shell.
              onSelect: () => location.assign(AGENT_CONNECTIONS_PATH),
            },
            { value: "logout", label: "Sign out", icon: <LogOut size={16} />, onSelect: () => void logout() },
          ]}
        >
          <ThemeChoice />
        </ActionMenu>
      )}
    </Show>
  )
}
