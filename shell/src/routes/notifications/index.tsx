import { signInUrl } from "@mosaik/auth/contract"
import { sessionQueryOptions } from "@mosaik/auth/web"
import { searchValidator } from "@mosaik/client/solid"
import { PageTitle } from "@mosaik/frame"
import { Button, Card, EmptyState, Tabs } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { QueryBoundary } from "@mosaik/web-kit"
import { useInfiniteQuery } from "@tanstack/solid-query"
import { createFileRoute, Link, redirect } from "@tanstack/solid-router"
import { Schema } from "effect"
import Bell from "lucide-solid/icons/bell"
import BellOff from "lucide-solid/icons/bell-off"
import Settings from "lucide-solid/icons/settings"
import { For, Show } from "solid-js"
import { inboxQuery } from "../../notifications/api"
import { NotificationList, useInboxActions } from "../../notifications/NotificationList"

const InboxSearch = Schema.Struct({ unread: Schema.optional(Schema.Literals(["true"])) })

export const Route = createFileRoute("/_app/notifications/")({
  staticData: { title: "Notifications", keywords: ["inbox", "alerts", "unread"] },
  validateSearch: searchValidator(InboxSearch),
  beforeLoad: async ({ context, location }) => {
    const { principal } = await context.queryClient.ensureQueryData(sessionQueryOptions())
    if (!principal.isAuthenticated) throw redirect({ href: signInUrl(location.href), reloadDocument: true })
  },
  component: NotificationsPage,
})

function NotificationsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const unreadOnly = () => search().unread === "true"
  const inbox = useInfiniteQuery(() => inboxQuery(unreadOnly()))
  const actions = useInboxActions()
  const items = () => inbox.data?.pages.flatMap((page) => page.items) ?? []
  const unread = () => inbox.data?.pages[0]?.unread ?? 0

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "6", maxW: "3xl" })}>
      <PageTitle
        title="Notifications"
        icon={<Bell size={18} />}
        actions={
          <>
            <Show when={unread() > 0}>
              <Button
                variant="outline"
                size="xs"
                loading={actions.markAllRead.isPending}
                onClick={() => actions.markAllRead.mutate()}
              >
                Mark all as read
              </Button>
            </Show>
            <Button
              variant="plain"
              size="xs"
              asChild={(link) => (
                <Link to="/notifications/settings" {...link()}>
                  <Settings size={16} />
                  Settings
                </Link>
              )}
            />
          </>
        }
      />
      <Tabs.Root
        value={unreadOnly() ? "unread" : "all"}
        onValueChange={({ value }) => void navigate({ search: { unread: value === "unread" ? "true" : undefined } })}
      >
        <Tabs.List>
          <For
            each={[
              { value: "all", label: "All" },
              { value: "unread", label: unread() > 0 ? `Unread (${unread()})` : "Unread" },
            ]}
          >
            {(item) => <Tabs.Trigger value={item.value}>{item.label}</Tabs.Trigger>}
          </For>
        </Tabs.List>
      </Tabs.Root>
      <QueryBoundary query={inbox}>
        {() => (
          <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
            <Card.Root>
              <NotificationList
                items={items()}
                onOpen={actions.open}
                onMarkRead={(item) => actions.markRead.mutate([item.id])}
                empty={
                  <EmptyState
                    icon={<BellOff size={24} />}
                    title={unreadOnly() ? "No unread notifications" : "No notifications yet"}
                    description="Apps notify you about things that need your attention."
                  />
                }
              />
            </Card.Root>
            <Show when={inbox.hasNextPage}>
              <div class={css({ display: "flex", justifyContent: "center" })}>
                <Button variant="outline" loading={inbox.isFetchingNextPage} onClick={() => void inbox.fetchNextPage()}>
                  Load older notifications
                </Button>
              </div>
            </Show>
          </div>
        )}
      </QueryBoundary>
    </div>
  )
}
