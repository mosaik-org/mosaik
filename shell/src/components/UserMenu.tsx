import { AGENT_CONNECTIONS_PATH, admin, signInUrl } from "@mosaik/auth/contract"
import { signOut, usePrincipal } from "@mosaik/auth/web"
import { toast } from "@mosaik/client"
import { managesAnyApp } from "@mosaik/console"
import { Badge, Button, Menu, ThemeChoice, ThemeToggle } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { UserAvatar } from "@mosaik/web-kit"
import { useQueryClient } from "@tanstack/solid-query"
import { useNavigate } from "@tanstack/solid-router"
import Bell from "lucide-solid/icons/bell"
import Bot from "lucide-solid/icons/bot"
import LogOut from "lucide-solid/icons/log-out"
import { Show } from "solid-js"
import { Portal } from "solid-js/web"
import { version } from "../../package.json"

const styles = {
  // The avatar alone: the name is in the menu (and read out with the button), and the top bar's room is the app's.
  trigger: css({
    display: "grid",
    placeItems: "center",
    borderRadius: "full",
    cursor: "pointer",
    outlineOffset: "2px",
    // A ring around the avatar itself (its root, not its letters or image).
    _hover: { "& [data-scope=avatar][data-part=root]": { boxShadow: "0 0 0 2px token(colors.gray.subtle.bg.hover)" } },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg" },
  }),
  content: css({ minW: "64" }),
  // Who is signed in: the person first, then how to reach them and what they may do.
  person: css({ display: "flex", alignItems: "center", gap: "3", px: "2", pt: "2", pb: "2.5" }),
  who: css({ display: "flex", flexDirection: "column", minW: "0", flex: "1" }),
  name: css({ fontSize: "sm", fontWeight: "semibold", color: "fg.default", truncate: true }),
  email: css({ fontSize: "xs", color: "fg.muted", truncate: true }),
  icon: css({ color: "fg.muted" }),
  version: css({ px: "2", pt: "1", pb: "1.5", fontSize: "xs", color: "fg.muted" }),
}

/**
 * The signed-in person's menu, behind their avatar: who they are and what they may do, their
 * settings, the theme, and signing out, apart from the rest. Signed out, the theme's toggle and
 * "Log in" instead.
 */
export const UserMenu = () => {
  const principal = usePrincipal()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const role = () =>
    principal().can(admin.accessPermission) ? "Admin" : managesAnyApp(principal()) ? "App owner" : undefined

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
          <Button
            size="xs"
            asChild={(link) => (
              <a href={signInUrl(`${location.pathname}${location.search}`)} {...link()}>
                Log in
              </a>
            )}
          />
        </>
      }
    >
      {(user) => (
        <Menu.Root positioning={{ placement: "bottom-end" }}>
          <Menu.Trigger
            asChild={(trigger) => (
              <button type="button" {...trigger()} class={styles.trigger} aria-label={`Account menu: ${user().name}`}>
                <UserAvatar user={user()} size="sm" />
              </button>
            )}
          />
          <Portal>
            <Menu.Positioner>
              <Menu.Content class={styles.content}>
                <div class={styles.person}>
                  <UserAvatar user={user()} size="md" />
                  <div class={styles.who}>
                    <span class={styles.name}>{user().name}</span>
                    <span class={styles.email}>{user().email}</span>
                  </div>
                  <Show when={role()}>
                    {(label) => (
                      <Badge size="sm" variant="surface" colorPalette="gray">
                        {label()}
                      </Badge>
                    )}
                  </Show>
                </div>
                <Menu.Separator />
                <Menu.ItemGroup>
                  <Menu.Item value="notifications" onSelect={() => void navigate({ to: "/notifications/settings" })}>
                    <Bell size={16} class={styles.icon} />
                    Notification settings
                  </Menu.Item>
                  {/* Core's own page, outside the shell. */}
                  <Menu.Item value="agents" onSelect={() => location.assign(AGENT_CONNECTIONS_PATH)}>
                    <Bot size={16} class={styles.icon} />
                    AI clients
                  </Menu.Item>
                </Menu.ItemGroup>
                <Menu.Separator />
                <ThemeChoice />
                <Menu.Separator />
                <Menu.Item value="logout" onSelect={() => void logout()}>
                  <LogOut size={16} class={styles.icon} />
                  Sign out
                </Menu.Item>
                <div class={styles.version}>Mosaik {version}</div>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      )}
    </Show>
  )
}
