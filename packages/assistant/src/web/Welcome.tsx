import { usePrincipal } from "@mosaik/auth/web"
import { css } from "@mosaik/styled-system/css"
import { Button } from "@mosaik/ui"
import { useQuery } from "@tanstack/solid-query"
import Sparkles from "lucide-solid/icons/sparkles"
import { For, type JSX, Show } from "solid-js"
import { assistant } from "./api"

const styles = {
  root: css({
    m: "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5",
    maxWidth: "lg",
    width: "full",
    textAlign: "center",
    py: "8",
  }),
  mark: css({
    display: "grid",
    placeItems: "center",
    width: "12",
    height: "12",
    borderRadius: "full",
    bg: "gray.subtle",
    color: "fg.muted",
  }),
  greeting: css({ display: "flex", flexDirection: "column", gap: "1" }),
  title: css({ fontSize: "xl", fontWeight: "semibold", color: "fg" }),
  lead: css({ fontSize: "sm", color: "fg.muted" }),
  suggestions: css({ display: "grid", gridTemplateColumns: { base: "1fr", sm: "1fr 1fr" }, gap: "2", width: "full" }),
  // A Button that wraps: a question may take two lines.
  suggestion: css({
    h: "auto",
    minH: "10",
    py: "2.5",
    whiteSpace: "normal",
    justifyContent: "flex-start",
    textAlign: "start",
    fontWeight: "normal",
  }),
}

/**
 * A new conversation: a greeting, and questions to start with, from the apps the person can use
 * (their tools' examples). Picking one asks it.
 */
export const Welcome = (props: {
  readonly enabled: boolean
  readonly onPick: (question: string) => void
}): JSX.Element => {
  const principal = usePrincipal()
  const suggestions = useQuery(() => ({ ...assistant.assistant.suggestions.query(), enabled: props.enabled }))
  const firstName = () => principal().user?.name.split(" ")[0]
  return (
    <div class={styles.root}>
      <span class={styles.mark} aria-hidden="true">
        <Sparkles size={22} />
      </span>
      <div class={styles.greeting}>
        <Show when={props.enabled} fallback={<span class={styles.title}>The assistant is not set up yet</span>}>
          <span class={styles.title}>
            {firstName() === undefined ? "What can I help with?" : `Hi ${firstName()}, what can I help with?`}
          </span>
        </Show>
        <span class={styles.lead}>
          {props.enabled
            ? "Ask about anything in your apps. I can look things up, link to them, and make changes once you allow them."
            : "An admin chooses the model it uses."}
        </span>
      </div>
      <Show when={props.enabled && (suggestions.data?.length ?? 0) > 0}>
        <div class={styles.suggestions}>
          <For each={suggestions.data}>
            {(question) => (
              <Button variant="outline" class={styles.suggestion} onClick={() => props.onPick(question)}>
                {question}
              </Button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
