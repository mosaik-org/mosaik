import { css } from "@mosaik/styled-system/css"
import RefreshCw from "lucide-solid/icons/refresh-cw"
import TriangleAlert from "lucide-solid/icons/triangle-alert"
import { mergeProps, Show } from "solid-js"
import { Button } from "./button"

const styles = {
  root: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "3",
    py: "10",
    px: "6",
    textAlign: "center",
  }),
  icon: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSize: "12",
    bg: "danger.subtle",
    color: "danger.text",
    borderRadius: "full",
    "& svg": { boxSize: "6" },
  }),
  text: css({ display: "flex", flexDirection: "column", gap: "1", maxW: "md" }),
  title: css({ fontSize: "md", fontWeight: "semibold", color: "fg.default" }),
  message: css({ fontSize: "sm", color: "fg.muted", overflowWrap: "anywhere" }),
}

export interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  /** Defaults to "Try again". */
  retryLabel?: string
}

export function ErrorState(props: ErrorStateProps) {
  const merged = mergeProps({ title: "Something went wrong", retryLabel: "Try again" }, props)

  return (
    <div class={styles.root} role="alert">
      <div class={styles.icon} aria-hidden="true">
        <TriangleAlert />
      </div>
      <div class={styles.text}>
        <p class={styles.title}>{merged.title}</p>
        <p class={styles.message}>{merged.message}</p>
      </div>
      <Show when={merged.onRetry}>
        <Button variant="outline" size="sm" onClick={() => merged.onRetry?.()}>
          <RefreshCw size={14} />
          {merged.retryLabel}
        </Button>
      </Show>
    </div>
  )
}
