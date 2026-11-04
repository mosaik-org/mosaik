import { usePageStatuses } from "@mosaik/client/solid"
import { statusSentence } from "@mosaik/core"
import { Card } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { AppIcon, StatusMark, summarize } from "@mosaik/web-kit"
import { Link } from "@tanstack/solid-router"
import CircleDot from "lucide-solid/icons/circle-dot"
import { For, type JSX } from "solid-js"
import { appForPath } from "../apps"
import { linkTarget } from "./model"

const styles = {
  list: css({ display: "flex", flexDirection: "column", p: "1" }),
  item: css({
    display: "flex",
    alignItems: "center",
    gap: "3",
    px: "3",
    py: "2",
    borderRadius: "l2",
    fontSize: "sm",
    color: "fg.default",
    _hover: { bg: "gray.subtle.bg" },
    _focusVisible: { outline: "2px solid", outlineColor: "accent.solid.bg", outlineOffset: "-2px" },
  }),
  icon: css({ display: "flex", color: "fg.muted", flexShrink: "0" }),
  text: css({ flex: "1", minW: "0", display: "flex", flexDirection: "column" }),
  place: css({ fontSize: "xs", color: "fg.muted" }),
}

/** Everything that waits for the person, across apps, each a link to where it is. */
export const NeedsYou = (): JSX.Element => {
  const statuses = usePageStatuses()
  return (
    <Card.Root>
      <nav class={styles.list} aria-label="Needs you">
        <For each={statuses()}>
          {(status) => {
            const app = appForPath(status.path)
            return (
              <Link {...linkTarget(status.link)} class={styles.item}>
                <span class={styles.icon}>
                  {app === undefined ? <CircleDot size={16} /> : <AppIcon name={app.portal.icon} size={16} />}
                </span>
                <span class={styles.text}>
                  <span class={css({ truncate: true })}>{statusSentence(status)}</span>
                  <span class={styles.place}>{app?.name ?? "Mosaik"}</span>
                </span>
                <StatusMark summary={summarize([status])} />
              </Link>
            )
          }}
        </For>
      </nav>
    </Card.Root>
  )
}
