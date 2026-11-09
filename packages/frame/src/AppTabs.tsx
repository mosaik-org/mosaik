import { usePageStatuses } from "@mosaik/client/solid"
import { css } from "@mosaik/styled-system/css"
import { Link } from "@tanstack/solid-router"
import ChevronDown from "lucide-solid/icons/chevron-down"
import { createEffect, createSignal, For, type JSX, on, onCleanup, onMount, Show } from "solid-js"
import type { NavTabItem } from "./NavTabs"
import { PagesMenu } from "./PagesMenu"
import { StatusMark } from "./StatusMark"
import { statusesAt, summarize } from "./statusSummary"
import { tabsThatFit } from "./tabsThatFit"

const styles = {
  nav: css({ position: "relative", display: "flex", alignSelf: "stretch", flex: "1", minW: "0", hideBelow: "md" }),
  row: css({ display: "flex", alignItems: "stretch", gap: "1" }),
  // A copy of the row, never seen: what each tab would take, to know how many fit.
  measure: css({
    position: "absolute",
    top: "0",
    left: "0",
    display: "flex",
    gap: "1",
    visibility: "hidden",
    pointerEvents: "none",
  }),
  tab: css({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "1.5",
    px: "2.5",
    fontSize: "sm",
    color: "fg.muted",
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition: "color 0.15s",
    _hover: { color: "fg" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid", outlineOffset: "-4px", borderRadius: "l2" },
    // The open page: underlined along the bar's bottom edge.
    "&[data-active=true]": {
      color: "fg",
      fontWeight: "medium",
      _after: {
        content: '""',
        position: "absolute",
        insetX: "2",
        bottom: "-1px",
        height: "2px",
        borderRadius: "full",
        bg: "fg",
      },
    },
  }),
}

/**
 * An app's pages as tabs in the frame's header, the open one underlined, each with what its
 * statuses come to. As many as fit show; the rest are in "More", underlined while one of them is
 * open. Shown from tablets up (`AppLayout` gives phones a menu).
 */
export const AppTabs = (props: {
  readonly label: string
  readonly links: ReadonlyArray<NavTabItem>
  /** The page open (its path). */
  readonly current: string | undefined
  /** The app's own address: what is there is the app's, shown beside it in the sidebar, not on a tab. */
  readonly home: string
}): JSX.Element => {
  const statuses = usePageStatuses()
  const markOf = (link: NavTabItem) =>
    summarize(link.to === props.home ? [] : statusesAt(statuses(), link.to, { below: false }))

  let nav: HTMLElement | undefined
  let measure: HTMLDivElement | undefined
  const [shown, setShown] = createSignal(props.links.length)
  const fit = () => {
    if (nav === undefined || measure === undefined) return
    const [more, ...tabs] = [...measure.children].map((child) => (child as HTMLElement).offsetWidth)
    setShown(
      tabsThatFit(tabs, nav.clientWidth, {
        more: more ?? 0,
        gap: Number.parseFloat(getComputedStyle(measure).columnGap) || 0,
      }),
    )
  }
  onMount(() => {
    const observer = new ResizeObserver(fit)
    if (nav !== undefined) observer.observe(nav)
    onCleanup(() => observer.disconnect())
  })
  // Other pages (permissions changed) or other marks (statuses changed) take other room.
  createEffect(on([() => props.links, statuses], () => queueMicrotask(fit)))

  const hidden = () => props.links.slice(shown())
  const isOpen = (link: NavTabItem) => link.to === props.current
  const tab = (link: NavTabItem) => (
    <>
      {link.label}
      <StatusMark summary={markOf(link)} />
    </>
  )

  return (
    <nav ref={nav} class={styles.nav} aria-label={props.label}>
      <div class={styles.row}>
        <For each={props.links.slice(0, shown())}>
          {(link) => (
            <Link
              to={link.to}
              class={styles.tab}
              data-active={isOpen(link)}
              aria-current={isOpen(link) ? "page" : undefined}
            >
              {tab(link)}
            </Link>
          )}
        </For>
        <Show when={hidden().length > 0}>
          <PagesMenu
            trigger={(trigger) => (
              // After the trigger's own props: it looks like the tabs, not like the menu's button.
              <button type="button" {...trigger()} class={styles.tab} data-active={hidden().some(isOpen)}>
                More <ChevronDown size={14} />
              </button>
            )}
            links={hidden()}
            current={props.current}
          />
        </Show>
      </div>
      <div ref={measure} class={styles.measure} aria-hidden="true">
        <span class={styles.tab}>
          More <ChevronDown size={14} />
        </span>
        <For each={props.links}>{(link) => <span class={styles.tab}>{tab(link)}</span>}</For>
      </div>
    </nav>
  )
}
