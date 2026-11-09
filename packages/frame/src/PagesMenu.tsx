import { Menu } from "@mosaik/ui"
import { useNavigate } from "@tanstack/solid-router"
import { For, type JSX } from "solid-js"
import { Portal } from "solid-js/web"
import type { NavTabItem } from "./NavTabs"

/**
 * An app's pages in a menu, the open one checked: where tabs have no room (phones, "More"). A choice
 * of one among them rather than a list of actions, so the labels line up past the check's column and
 * assistive technology says which page is open.
 */
export const PagesMenu = (props: {
  /** The button that opens it: spread `props()` on it. */
  readonly trigger: (props: () => JSX.HTMLAttributes<HTMLButtonElement>) => JSX.Element
  readonly links: ReadonlyArray<NavTabItem>
  /** The page open (its path), checked if it is one of `links`. */
  readonly current: string | undefined
}) => {
  const navigate = useNavigate()
  return (
    <Menu.Root>
      <Menu.Trigger asChild={props.trigger} />
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.RadioItemGroup
              value={props.current ?? ""}
              onValueChange={(details) => void navigate({ href: details.value })}
            >
              <For each={props.links}>
                {(link) => (
                  <Menu.RadioItem value={link.to}>
                    <Menu.ItemIndicator />
                    <Menu.ItemText>{link.label}</Menu.ItemText>
                  </Menu.RadioItem>
                )}
              </For>
            </Menu.RadioItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
