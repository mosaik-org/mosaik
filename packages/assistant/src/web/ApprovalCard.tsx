import { css, cx } from "@mosaik/styled-system/css"
import { Badge, Button, Card } from "@mosaik/ui"
import Check from "lucide-solid/icons/check"
import ShieldAlert from "lucide-solid/icons/shield-exclamation-point"
import TriangleAlert from "lucide-solid/icons/triangle-exclamation-point"
import { For, type JSX, Show } from "solid-js"
import type { ToolCallPart } from "../contract"
import { useAppName } from "./browser"
import { inputFields } from "./format"

const styles = {
  // A card in the warning's colours, its left edge thick: it waits for the person.
  card: css({ borderLeftWidth: "4px", borderColor: "warning.7", bg: "warning.2" }),
  header: css({ gap: "2" }),
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

  inputs: css({
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    columnGap: "4",
    rowGap: "1",
    m: "0",
    px: "3",
    py: "2",
    borderRadius: "l2",
    bg: "bg.panel",
    fontSize: "sm",
    maxHeight: "48",
    overflowY: "auto",
    "& dt": { color: "fg.muted" },
    "& dd": { m: "0", overflowWrap: "anywhere", whiteSpace: "pre-wrap" },
  }),
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
    // Small, closer than a page's card: it sits in a conversation.
    <Card.Root
      size="sm"
      role="region"
      class={cx(styles.card, props.call.destructive && styles.destructive)}
      aria-label={`Approval: ${props.call.title}`}
    >
      <Card.Header class={styles.header}>
        <span class={cx(styles.label, props.call.destructive && styles.labelDestructive)}>
          <Show when={props.call.destructive} fallback={<ShieldAlert size={14} />}>
            <TriangleAlert size={14} />
          </Show>
          {props.call.destructive ? "Needs your approval · cannot be undone" : "Needs your approval"}
        </span>
        <div class={styles.heading}>
          <Card.Title>{props.call.title}</Card.Title>
          <Show when={props.call.app !== ""}>
            <Badge size="sm" variant="outline">
              {appName(props.call.app)}
            </Badge>
          </Show>
        </div>
      </Card.Header>
      <Show when={inputFields(props.call.input).length > 0}>
        <Card.Body>
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
        </Card.Body>
      </Show>
      <Card.Footer>
        <Button size="sm" variant="outline" disabled={props.busy} onClick={() => props.onDecide(false)}>
          Deny
        </Button>
        <Button
          size="sm"
          colorPalette={props.call.destructive ? "danger" : undefined}
          loading={props.busy}
          onClick={() => props.onDecide(true)}
        >
          <Check size={14} /> Allow
        </Button>
      </Card.Footer>
    </Card.Root>
  )
}
