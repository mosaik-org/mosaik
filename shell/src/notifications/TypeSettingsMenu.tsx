import { Menu } from "@mosaik/ui"
import { useQuery } from "@tanstack/solid-query"
import { useNavigate } from "@tanstack/solid-router"
import { For, type JSX, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { settingsQuery } from "./api"
import { CHANNELS, useChannelSetting } from "./settings"

/**
 * Where notifications of one type reach the person, changed right where one arrived: the quickest way
 * to have fewer of them. The same settings as the settings page, which the menu links to.
 */
export const TypeSettingsMenu = (props: {
  /** The notification type's key, e.g. `desk:request.overdue`. */
  type: string
  trigger: (trigger: () => JSX.HTMLAttributes<HTMLButtonElement>) => JSX.Element
}) => {
  const settings = useQuery(settingsQuery)
  const update = useChannelSetting()
  const navigate = useNavigate()
  const type = () => settings.data?.types.find((candidate) => candidate.key === props.type)
  const channels = () => CHANNELS.filter((channel) => settings.data?.available.includes(channel.value) === true)

  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild={props.trigger} />
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel>{type()?.description ?? "Notifications like this"}</Menu.ItemGroupLabel>
              <Show when={type()}>
                {(found) => (
                  <For each={channels()}>
                    {(channel) => (
                      <Menu.CheckboxItem
                        value={channel.value}
                        checked={found().channels[channel.value]}
                        // The menu stays open: switching one channel often goes with another.
                        closeOnSelect={false}
                        onCheckedChange={(enabled) =>
                          update.mutate({ type: props.type, channel: channel.value, enabled })
                        }
                      >
                        {channel.label}
                        <Menu.ItemIndicator />
                      </Menu.CheckboxItem>
                    )}
                  </For>
                )}
              </Show>
            </Menu.ItemGroup>
            <Menu.Separator />
            <Menu.Item value="settings" onSelect={() => void navigate({ to: "/notifications/settings" })}>
              All notification settings
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
