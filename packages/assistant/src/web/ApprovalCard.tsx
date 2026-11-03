import { Badge, Button } from "@mosaik/mosaik-ui"
import { css, cx } from "@mosaik/styled-system/css"
import Check from "lucide-solid/icons/check"
import ShieldAlert from "lucide-solid/icons/shield-alert"
import TriangleAlert from "lucide-solid/icons/triangle-alert"
import { For, type JSX, Show } from "solid-js"
import type { ToolCallPart } from "../contract"
import { useAppName } from "./browser"
import { inputFields } from "./format"

const styles = {
  card: css({
    display: "flex",
    flexDirection: "column",
    gap: "3",
    p: "4",
    borderWidth: "1px",
    borderLeftWidth: "4px",
    borderRadius: "l3",
    borderColor: "warning.7",
    bg: "warning.2",
  }),
  destructive: css({ borderColor: "danger.7", bg: "danger.2" }),
  label: css({
    display: "flex",
    alignItems: "center",
    gap: "1.5",
    fontSize: "xs",
    fontWeight: "semibold",
    textTransform: "uppercase",
    letterSpacing: "wide",
    color: "warning.11",
  }),
  labelDestructive: css({ color: "danger.11" }),
  heading: css({ display: "flex", alignItems: "center", gap: "2", flexWrap: "wrap" }),
  title: css({ fontSize: "md", fontWeight: "semibold", color: "fg.default" }),
  inputs: css({
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    columnGap: "4",
    rowGap: "1",
    m: "0",
    px: "3",
    py: "2",
    borderRadius: "l2",
    bg: "gray.surface.bg",
    fontSize: "sm",
    maxHeight: "48",
    overflowY: "auto",
    "& dt": { color: "fg.muted" },
    "& dd": { m: "0", overflowWrap: "anywhere", whiteSpace: "pre-wrap" },
  }),
  actions: css({ display: "flex", justifyContent: "flex-end", gap: "2" }),
}

/**
 * A change the assistant wants to make, waiting for the person: what it does, in which app, with
 * which values, and whether it can be undone; they allow or deny it here.
 */
export const ApprovalCard = (props: {
  readonly call: ToolCallPart
  readonly busy: boolean
  readonly onDecide: (approve: boolean) => void
}): JSX.Element => {
  const appName = useAppName()
  return (
    <section
      class={cx(styles.card, props.call.destructive && styles.destructive)}
      aria-label={`Approval: ${props.call.title}`}
    >
      <span class={cx(styles.label, props.call.destructive && styles.labelDestructive)}>
        <Show when={props.call.destructive} fallback={<ShieldAlert size={14} />}>
          <TriangleAlert size={14} />
        </Show>
        {props.call.destructive ? "Needs your approval · cannot be undone" : "Needs your approval"}
      </span>
      <div class={styles.heading}>
        <span class={styles.title}>{props.call.title}</span>
        <Show when={props.call.app !== ""}>
          <Badge size="sm" variant="outline">
            {appName(props.call.app)}
          </Badge>
        </Show>
      </div>
      <Show when={inputFields(props.call.input).length > 0}>
        <dl class={styles.inputs}>
          <For each={inputFields(props.call.input)}>
            {([name, value]) => (
              <>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </>
            )}
          </For>
        </dl>
      </Show>
      <div class={styles.actions}>
        <Button size="sm" variant="outline" disabled={props.busy} onClick={() => props.onDecide(false)}>
          Deny
        </Button>
        <Button
          size="sm"
          colorPalette={props.call.destructive ? "danger" : "accent"}
          loading={props.busy}
          onClick={() => props.onDecide(true)}
        >
          <Check size={14} /> Allow
        </Button>
      </div>
    </section>
  )
}
