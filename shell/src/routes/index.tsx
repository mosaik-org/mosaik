import { signInUrl } from "@mosaik/auth/contract"
import { usePrincipal } from "@mosaik/auth/web"
import type { AnyApp } from "@mosaik/core"
import { Button, Card, EmptyState, PageHeader } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { AppIcon } from "@mosaik/web-kit"
import { useQuery } from "@tanstack/solid-query"
import { createFileRoute, Link } from "@tanstack/solid-router"
import ArrowRight from "lucide-solid/icons/arrow-right"
import FileText from "lucide-solid/icons/file-text"
import LayoutGrid from "lucide-solid/icons/layout-grid"
import { For, type JSX, Show } from "solid-js"
import { allApps, appHref } from "../apps"
import { unreadPreviewQuery } from "../notifications/api"
import { NotificationList, useInboxActions } from "../notifications/NotificationList"
import { FEW_APPS, useMyApps } from "../workspace/myApps"
import { readRecentPages } from "../workspace/recentPages"

export const Route = createFileRoute("/_app/")({
  staticData: { title: "Overview", keywords: ["home", "apps"] },
  component: Home,
})

const styles = {
  layout: css({
    display: "grid",
    gap: "6",
    gridTemplateColumns: { base: "1fr", lg: "minmax(0, 2fr) minmax(0, 1fr)" },
    alignItems: "start",
  }),
  column: css({ display: "flex", flexDirection: "column", gap: "6", minW: "0" }),
  section: css({ display: "flex", flexDirection: "column", gap: "3" }),
  sectionHeader: css({ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "3" }),
  sectionTitle: css({ fontSize: "md", fontWeight: "semibold" }),
  // Equal columns whatever the tiles say: a long description is truncated, it does not widen its column.
  grid: css({
    display: "grid",
    gap: "3",
    gridTemplateColumns: { base: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
  }),
  tileLink: css({ display: "block", minW: "0" }),
  tile: css({
    height: "full",
    transition: "border-color 0.15s",
    _hover: { borderColor: "accent.solid.bg" },
  }),
  icon: css({
    display: "grid",
    placeItems: "center",
    flexShrink: "0",
    width: "10",
    height: "10",
    borderRadius: "lg",
    bg: "accent.subtle.bg",
    color: "accent.plain.fg",
  }),
  tileText: css({ display: "flex", flexDirection: "column", gap: "0.5", minW: "0" }),
  name: css({ fontWeight: "semibold", truncate: true }),
  description: css({ color: "fg.muted", fontSize: "sm", truncate: true }),
  more: css({
    display: "inline-flex",
    alignItems: "center",
    gap: "1",
    fontSize: "sm",
    fontWeight: "medium",
    color: "accent.plain.fg",
    _hover: { textDecoration: "underline" },
  }),
  hint: css({ fontSize: "sm", color: "fg.muted" }),
  pages: css({ display: "flex", flexDirection: "column" }),
  page: css({
    display: "flex",
    alignItems: "center",
    gap: "3",
    px: "4",
    py: "2.5",
    fontSize: "sm",
    borderBottomWidth: "1px",
    borderColor: "border",
    _last: { borderBottomWidth: "0" },
    _hover: { bg: "gray.subtle.bg" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg", outlineOffset: "-2px" },
  }),
  pageApp: css({ ml: "auto", fontSize: "xs", color: "fg.subtle", flexShrink: "0" }),
  muted: css({ px: "4", py: "6", fontSize: "sm", color: "fg.muted", textAlign: "center" }),
}

const AppTile = (props: { app: AnyApp }) => (
  <Link to={appHref(props.app)} class={styles.tileLink}>
    <Card.Root class={styles.tile}>
      <Card.Body flexDirection="row" alignItems="center" gap="3">
        <div class={styles.icon}>
          <AppIcon name={props.app.portal.icon} size={20} />
        </div>
        <div class={styles.tileText}>
          <span class={styles.name}>{props.app.name}</span>
          <span class={styles.description} title={props.app.description}>
            {props.app.description}
          </span>
        </div>
      </Card.Body>
    </Card.Root>
  </Link>
)

/** A titled part of the page. Both columns are made of these, so their titles and contents line up. */
const Section = (props: { title: string; aside?: JSX.Element; children: JSX.Element }) => (
  <section class={styles.section} aria-label={props.title}>
    <div class={styles.sectionHeader}>
      <h2 class={styles.sectionTitle}>{props.title}</h2>
      {props.aside}
    </div>
    {props.children}
  </section>
)

const AppSection = (props: { title: string; apps: ReadonlyArray<AnyApp>; aside?: JSX.Element }) => (
  <Section title={props.title} aside={props.aside}>
    <div class={styles.grid}>
      <For each={props.apps}>{(app) => <AppTile app={app} />}</For>
    </div>
  </Section>
)

const AllAppsLink = () => (
  <Link to="/directory" class={styles.more}>
    All {allApps.length} apps <ArrowRight size={14} />
  </Link>
)

/** The logged-in user's start page: their apps, what happened, and where they were. */
const Personal = (props: { user: string }) => {
  const apps = useMyApps()
  const unread = useQuery(unreadPreviewQuery)
  const inbox = useInboxActions()
  const pages = readRecentPages(props.user)
  const pageApp = (id: string | undefined) => allApps.find((app) => app.id === id)?.name

  // Without pins or history yet: a few apps to start from.
  const starters = () => (apps.pinned().length > 0 || apps.recent().length > 0 ? [] : apps.accessible())

  return (
    <div class={styles.layout}>
      <div class={styles.column}>
        <Show when={apps.pinned().length > 0}>
          <AppSection title="Pinned" apps={apps.pinned()} aside={<AllAppsLink />} />
        </Show>
        <Show when={apps.recent().length > 0}>
          <AppSection
            title="Recently used"
            apps={apps.recent()}
            aside={apps.pinned().length === 0 ? <AllAppsLink /> : undefined}
          />
        </Show>
        <Show when={starters().length > 0}>
          <AppSection
            title={starters().length > FEW_APPS ? "Some apps to start with" : "Your apps"}
            apps={starters().slice(0, FEW_APPS)}
            aside={<AllAppsLink />}
          />
          <p class={styles.hint}>
            Pin the apps you use (from the sidebar or All apps) to keep them here and in the sidebar.
          </p>
        </Show>
        <Show when={apps.accessible().length === 0}>
          <EmptyState
            icon={<LayoutGrid size={32} />}
            title="No apps available yet"
            description="Find the app you need in All apps and ask for access."
            action={
              <Link to="/directory">
                <Button variant="outline">Browse all apps</Button>
              </Link>
            }
          />
        </Show>
      </div>

      <div class={styles.column}>
        <Section
          title="Unread notifications"
          aside={
            <Link to="/notifications" class={styles.more}>
              All <ArrowRight size={14} />
            </Link>
          }
        >
          <Card.Root>
            <NotificationList
              items={unread.data?.items ?? []}
              onOpen={inbox.open}
              empty={<div class={styles.muted}>You are all caught up.</div>}
            />
          </Card.Root>
        </Section>
        <Show when={pages.length > 0}>
          <Section title="Recent pages">
            <Card.Root>
              <nav class={styles.pages} aria-label="Recent pages">
                <For each={pages.slice(0, 6)}>
                  {(page) => (
                    <Link to={page.path} class={styles.page}>
                      <FileText size={14} />
                      <span class={css({ truncate: true })}>{page.title}</span>
                      <span class={styles.pageApp}>{pageApp(page.app)}</span>
                    </Link>
                  )}
                </For>
              </nav>
            </Card.Root>
          </Section>
        </Show>
      </div>
    </div>
  )
}

/** Visitors: the apps open to everyone, and why to log in. */
const Visitor = () => {
  const apps = useMyApps()
  return (
    <div class={styles.column}>
      <Show when={apps.accessible().length > 0}>
        <AppSection title="Open to everyone" apps={apps.accessible()} aside={<AllAppsLink />} />
      </Show>
      <Card.Root>
        <Card.Body gap="4">
          <div
            class={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "4",
              flexWrap: "wrap",
            })}
          >
            <div>
              <div class={styles.name}>More apps are available after logging in</div>
              <div class={styles.hint}>Sign in with your company account or email.</div>
            </div>
            <a href={signInUrl("/")}>
              <Button>Log in</Button>
            </a>
          </div>
        </Card.Body>
      </Card.Root>
    </div>
  )
}

function Home() {
  const principal = usePrincipal()
  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "6" })}>
      <PageHeader
        title={principal().user ? `Welcome back, ${principal().user?.name}` : "Apps"}
        description={principal().user ? "Your apps, and what happened since you were last here." : undefined}
      />
      <Show when={principal().user} fallback={<Visitor />} keyed>
        {(user) => <Personal user={user.id} />}
      </Show>
    </div>
  )
}
