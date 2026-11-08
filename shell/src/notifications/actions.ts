import { errorMessage, toast } from "@mosaik/client"
import type { InboxItem } from "@mosaik/notifications/contract"
import { useMutation, useQueryClient } from "@tanstack/solid-query"
import { useRouter } from "@tanstack/solid-router"
import { DateTime } from "effect"
import { notificationKeys, notificationsApi } from "./api"
import type { SnoozeChoice } from "./snooze"

const ids = (items: ReadonlyArray<InboxItem>) => items.map((item) => item.id)

/** "Resolved", "Done" or "2 resolved": what a person did, in the words the items use. */
const didWhat = (items: ReadonlyArray<InboxItem>) => {
  const verb = items.every((item) => !item.action) ? "Done" : "Resolved"
  return items.length === 1 ? verb : `${items.length} ${verb.toLowerCase()}`
}

/**
 * What a person does with their inbox: open, read, resolve, snooze and undo. Every change says what it
 * did and offers to take it back, as a resolved item leaves the list at once.
 */
export const useInboxActions = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: notificationKeys.all })
  const onError = (error: unknown) => toast.error("Could not update notifications", errorMessage(error))
  const change = (call: (items: ReadonlyArray<number>) => Promise<unknown>) =>
    useMutation(() => ({ mutationFn: call, onSuccess: invalidate, onError }))

  const markReadMutation = change((items) =>
    notificationsApi((client) => client.inbox.markRead({ payload: { ids: items } })),
  )
  const reopenMutation = change((items) =>
    notificationsApi((client) => client.inbox.reopen({ payload: { ids: items } })),
  )
  const resolveMutation = change((items) =>
    notificationsApi((client) => client.inbox.resolve({ payload: { ids: items } })),
  )
  const snoozeMutation = useMutation(() => ({
    mutationFn: (input: { readonly items: ReadonlyArray<number>; readonly until: Date }) =>
      notificationsApi((client) =>
        client.inbox.snooze({ payload: { ids: input.items, until: DateTime.makeUnsafe(input.until) } }),
      ),
    onSuccess: invalidate,
    onError,
  }))
  const markAllRead = useMutation(() => ({
    mutationFn: () => notificationsApi((client) => client.inbox.markAllRead()),
    onSuccess: invalidate,
    onError,
  }))

  const undo = (items: ReadonlyArray<InboxItem>) => ({
    label: "Undo",
    onClick: () => reopenMutation.mutate(ids(items)),
  })

  const resolve = (items: ReadonlyArray<InboxItem>) => {
    const allowed = items.filter((item) => item.resolvable && item.state !== "resolved")
    if (allowed.length === 0) {
      // Pressing E on one only its app may resolve: say why nothing happened, and what can be done.
      if (items.some((item) => !item.resolvable)) {
        toast.info(
          "Only its app can resolve this",
          "It resolves once what it is about is handled. Snooze it to put it away.",
        )
      }
      return
    }
    resolveMutation.mutate(ids(allowed), { onSuccess: () => toast.success(didWhat(allowed), undefined, undo(allowed)) })
  }

  const snooze = (items: ReadonlyArray<InboxItem>, choice: SnoozeChoice) => {
    const open = items.filter((item) => item.state === "open")
    if (open.length === 0) return
    snoozeMutation.mutate(
      { items: ids(open), until: choice.until },
      { onSuccess: () => toast.success(`Snoozed: ${choice.label.toLowerCase()}`, undefined, undo(open)) },
    )
  }

  const open = (item: InboxItem) => {
    if (item.readAt === null) markReadMutation.mutate([item.id])
    const link = item.content.link
    if (link === undefined) return
    if (link.startsWith("/")) void router.history.push(link)
    else window.open(link, "_blank", "noopener,noreferrer")
  }

  return {
    open,
    resolve,
    snooze,
    reopen: (items: ReadonlyArray<InboxItem>) => reopenMutation.mutate(ids(items)),
    markRead: (items: ReadonlyArray<InboxItem>) =>
      markReadMutation.mutate(ids(items.filter((item) => item.readAt === null))),
    markAllRead,
    invalidate,
  }
}

export type InboxActions = ReturnType<typeof useInboxActions>
