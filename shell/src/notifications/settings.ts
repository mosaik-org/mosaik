import { errorMessage, toast } from "@mosaik/client"
import type { PersonalChannel } from "@mosaik/core"
import type { NotificationSettings } from "@mosaik/notifications/contract"
import { useMutation, useQueryClient } from "@tanstack/solid-query"
import { notificationKeys, notificationsApi } from "./api"

/** Where a person can get a notification, in the order shown. */
export const CHANNELS: ReadonlyArray<{ readonly value: PersonalChannel; readonly label: string }> = [
  { value: "inApp", label: "In app" },
  { value: "email", label: "E-mail" },
  { value: "slack", label: "Slack" },
]

export interface ChannelChange {
  readonly type: string
  readonly channel: PersonalChannel
  readonly enabled: boolean
}

/**
 * Turns one type of notification on or off on one channel, for the person: from the settings page, or
 * from an item ("notifications like this"). The switch flips at once; the response, or a refetch on
 * error, settles it.
 */
export const useChannelSetting = () => {
  const queryClient = useQueryClient()
  return useMutation(() => ({
    mutationFn: (change: ChannelChange) => notificationsApi((client) => client.settings.set({ payload: change })),
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.settings })
      queryClient.setQueryData<NotificationSettings>(notificationKeys.settings, (settings) =>
        settings === undefined
          ? settings
          : {
              ...settings,
              types: settings.types.map((type) =>
                type.key === change.type
                  ? { ...type, channels: { ...type.channels, [change.channel]: change.enabled } }
                  : type,
              ),
            },
      )
    },
    onError: (error: unknown) => {
      toast.error("Could not save the setting", errorMessage(error))
      void queryClient.invalidateQueries({ queryKey: notificationKeys.settings })
    },
  }))
}
