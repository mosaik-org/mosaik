import { errorMessage, toast } from "@mosaik/client"
import type { InboxItem } from "@mosaik/notifications/contract"
import { useMutation, useQueryClient } from "@tanstack/solid-query"
import { useRouter } from "@tanstack/solid-router"
import { DateTime } from "effect"
import { notificationKeys, notificationsApi } from "./api"
import { viewOf } from "./model"
import { type SnoozeTime, untilLabel } from "./snooze"

const ids = (items: ReadonlyArray<InboxItem>) => items.map((item) => item.id)

/** The API takes so many ids at a time. */
const BATCH = 500
const inBatches = (all: ReadonlyArray<number>) =>
  Array.from({ length: Math.ceil(all.length / BATCH) }, (_, i) => all.slice(i * BATCH, (i + 1) * BATCH))

/** "Resolved", "Done" or "2 resolved": what a person did, in the words the items use. */
const didWhat = (items: ReadonlyArray<InboxItem>) => {
  const verb = items.every((item) => !item.action) ? "Done" : "Resolved"
  return items.length === 1 ? verb : `${items.length} ${verb.toLowerCase()}`
}

/**
 * What a person does with their inbox: open, read, resolve, snooze, clear what is only to know, and
 * undo. Every change says what it did and offers to take it back, as a resolved item leaves the list at
 * once.
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
    Promise.all(
      inBatches(items).map((batch) => notificationsApi((client) => client.inbox.reopen({ payload: { ids: batch } }))),
    ),
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
  const resolveInformationMutation = useMutation(() => ({
    mutationFn: (source: string | undefined) =>
      notificationsApi((client) => client.inbox.resolveInformation({ payload: { source } })),
    onSuccess: invalidate,
    onError,
  }))

  const undo = (items: ReadonlyArray<number>) => ({
    label: "Undo",
    onClick: () => reopenMutation.mutate(items),
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
    resolveMutation.mutate(ids(allowed), {
      onSuccess: () => toast.success(didWhat(allowed), undefined, undo(ids(allowed))),
    })
  }

  const snooze = (items: ReadonlyArray<InboxItem>, time: SnoozeTime) => {
    const open = items.filter((item) => item.state === "open")
    if (open.length === 0) return
    snoozeMutation.mutate(
      { items: ids(open), until: time.until },
      {
        onSuccess: () =>
          toast.success(`Snoozed until ${untilLabel(time.until, new Date())}`, undefined, undo(ids(open))),
      },
    )
  }

  /** Clears what is only to know (one app's, with `source`), which is many at once: so it says how many. */
  const resolveInformation = (source: string | undefined) =>
    resolveInformationMutation.mutate(source, {
      onSuccess: ({ ids: cleared }) => {
        if (cleared.length === 0) return
        toast.success(cleared.length === 1 ? "1 done" : `${cleared.length} done`, undefined, undo(cleared))
      },
    })

  /** The item in the inbox, open beside its list: from the bell or the Overview. */
  const show = (item: InboxItem) => {
    const view = viewOf(item)
    void router.navigate({ to: "/notifications", search: { view: view === "todo" ? undefined : view, item: item.id } })
  }

  /** Where it is about, in its app (or another site); opening it there reads it. */
  const open = (item: InboxItem) => {
    if (item.readAt === null) markReadMutation.mutate([item.id])
    const link = item.content.link
    if (link === undefined) return
    if (link.startsWith("/")) void router.history.push(link)
    else window.open(link, "_blank", "noopener,noreferrer")
  }

  return {
    show,
    open,
    resolve,
    snooze,
    resolveInformation,
    resolvingInformation: () => resolveInformationMutation.isPending,
    reopen: (items: ReadonlyArray<InboxItem>) => reopenMutation.mutate(ids(items)),
    markRead: (items: ReadonlyArray<InboxItem>) =>
      markReadMutation.mutate(ids(items.filter((item) => item.readAt === null))),
    markAllRead,
    invalidate,
  }
}

export type InboxActions = ReturnType<typeof useInboxActions>
