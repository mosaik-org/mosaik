import { ActionMenu, ConfirmDialog, Heading, IconButton, Spinner, Tooltip } from "@mosaik/mosaik-ui"
import { toast } from "@mosaik/sdk/client"
import { css } from "@mosaik/sdk/css"
import { useQuery } from "@tanstack/solid-query"
import type { LucideProps } from "lucide-solid"
import ArrowLeft from "lucide-solid/icons/arrow-left"
import Check from "lucide-solid/icons/check"
import Ellipsis from "lucide-solid/icons/ellipsis"
import Link from "lucide-solid/icons/link"
import Pencil from "lucide-solid/icons/pencil"
import Plus from "lucide-solid/icons/plus"
import Reply from "lucide-solid/icons/reply"
import RotateCcw from "lucide-solid/icons/rotate-ccw"
import Trash from "lucide-solid/icons/trash"
import { createEffect, createSignal, type JSX, onCleanup, onMount, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { type ReplyKind, type RequestId, type RequestRow, requesterMayDelete, requestNumber } from "../../api"
import { desk as manifest } from "../../manifest"
import { AttentionReason } from "../components/AttentionReason"
import { useDesk } from "../context"
import { requestQuery } from "../queries"
import { createRequestPickers } from "../workspace/pickers"
import { Attributes } from "./Attributes"
import { Composer, type ComposerHandle } from "./Composer"
import { EditRequestDialog } from "./EditRequest"
import { Timeline } from "./Timeline"

const styles = {
  root: css({ display: "flex", flexDirection: "column", flex: "1", minH: "0", outline: "none" }),
  header: css({
    display: "flex",
    alignItems: "flex-start",
    gap: "3",
    px: { base: "4", lg: "6" },
    pt: "3",
    pb: "3",
    borderBottomWidth: "1px",
    borderColor: "border",
  }),
  back: css({ hideFrom: "md" }),
  heading: css({ flex: "1", minW: "0" }),
  number: css({ fontSize: "xs", color: "fg.muted", fontVariantNumeric: "tabular-nums" }),
  // Under the title, at the end of the request nearest the list, where the pointer already is.
  actions: css({ display: "flex", alignItems: "center", gap: "2", mt: "2" }),
  round: css({ borderRadius: "full" }),
  body: css({
    display: "grid",
    flex: "1",
    minH: "0",
    gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 240px" },
    gridTemplateRows: { base: "auto minmax(0, 1fr)", lg: "minmax(0, 1fr)" },
  }),
  story: css({ display: "flex", flexDirection: "column", minH: "0", minW: "0", gridRow: { base: "2", lg: "1" } }),
  loading: css({ display: "flex", flex: "1", alignItems: "center", justifyContent: "center", color: "fg.muted" }),
}

export interface RequestPaneHandle {
  /** Moves focus to the request, for reading it by keyboard. */
  readonly focus: () => void
  /** Moves focus to where to write. */
  readonly compose: (kind: ReplyKind) => void
}

/**
 * One request: its story, what to write, and everything about it. The round button is always the next
 * thing to do with it, so nobody has to work out what that is.
 */
export const RequestPane = (props: {
  id: RequestId
  /** As the list has it, to show at once while the rest loads. */
  listed: RequestRow | undefined
  forRequester: boolean
  onBack: () => void
  onLeave: () => void
  ref: (handle: RequestPaneHandle) => void
}) => {
  const desk = useDesk()
  const query = useQuery(() => ({ ...requestQuery(props.id), placeholderData: props.listed }))
  const pickers = createRequestPickers(desk)
  const [editing, setEditing] = createSignal(false)
  const [deleting, setDeleting] = createSignal(false)
  let root: HTMLElement | undefined
  let composer: ComposerHandle | undefined

  onMount(() =>
    props.ref({
      focus: () => root?.focus(),
      compose: (kind) => composer?.focus(kind),
    }),
  )

  // Seen for a moment rather than passed through on the way to the next one.
  createEffect(() => {
    if (query.data?.unread !== true) return
    const timer = setTimeout(() => desk.actions.markRead(props.id), 600)
    onCleanup(() => clearTimeout(timer))
  })

  const asAgent = () => desk.isAgent() && !props.forRequester

  return (
    <Show
      when={query.data}
      fallback={
        <div class={styles.loading}>
          <Show when={query.isError} fallback={<Spinner />}>
            This request is gone, or isn't yours to see.
          </Show>
        </div>
      }
    >
      {(row) => {
        const own = () => row().requesterId === desk.me()
        const mayEdit = () => row().status !== "closed" && (asAgent() || own())
        const mayDelete = () => desk.mayDelete() || (own() && requesterMayDelete(row()))
        return (
          <article ref={root} class={styles.root} tabIndex={-1}>
            <header class={styles.header}>
              <IconButton
                class={styles.back}
                size="sm"
                variant="plain"
                aria-label="Back to the list"
                onClick={props.onBack}
              >
                <ArrowLeft />
              </IconButton>
              <div class={styles.heading}>
                <div class={styles.number}>{`${requestNumber(row().id)} · ${row().queueName}`}</div>
                <Heading as="h2" textStyle="md" fontWeight="semibold">
                  {row().title}
                </Heading>
                <Show when={asAgent()}>
                  <AttentionReason request={row()} />
                </Show>
                <div class={styles.actions}>
                  <NextStep row={row()} asAgent={asAgent()} compose={(kind) => composer?.focus(kind)} />
                  <ActionMenu
                    trigger={(trigger) => (
                      <IconButton {...trigger()} size="sm" variant="plain" aria-label="More">
                        <Ellipsis />
                      </IconButton>
                    )}
                    items={[
                      ...(mayEdit()
                        ? [
                            {
                              value: "edit",
                              label: "Edit title and details",
                              icon: <Pencil />,
                              onSelect: () => setEditing(true),
                            },
                          ]
                        : []),
                      {
                        value: "copy",
                        label: "Copy link",
                        icon: <Link />,
                        onSelect: () => {
                          void navigator.clipboard.writeText(`${location.origin}/${manifest.id}/all?open=${row().id}`)
                          toast.success("Link copied")
                        },
                      },
                      ...(mayDelete()
                        ? [
                            {
                              value: "delete",
                              label: "Delete",
                              icon: <Trash />,
                              danger: true,
                              onSelect: () => setDeleting(true),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </div>
            </header>

            <div class={styles.body}>
              <div class={styles.story}>
                <Timeline row={row()} forRequester={!asAgent()} />
                <Show when={row().status !== "closed"}>
                  <Composer
                    id={row().id}
                    asAgent={asAgent()}
                    onLeave={props.onLeave}
                    ref={(handle) => {
                      composer = handle
                    }}
                  />
                </Show>
              </div>
              <Attributes row={row()} asAgent={asAgent()} pickers={pickers} />
            </div>

            <EditRequestDialog row={row()} open={editing()} onOpenChange={setEditing} />
            <ConfirmDialog
              open={deleting()}
              onOpenChange={setDeleting}
              title={`Delete ${requestNumber(row().id)}?`}
              description="Its story and its files go with it. This can't be undone."
              confirmLabel="Delete"
              tone="danger"
              onConfirm={() => {
                setDeleting(false)
                void desk.actions.remove(row().id)
              }}
            />
          </article>
        )
      }}
    </Show>
  )
}

/** The one thing to do next, from where the request stands. */
interface Step {
  readonly label: string
  readonly icon: (props: LucideProps) => JSX.Element
  /** The key that does the same, when there is one for this person. */
  readonly keyName?: string
  readonly run: () => void
}

const NextStep = (props: { row: RequestRow; asAgent: boolean; compose: (kind: ReplyKind) => void }) => {
  const desk = useDesk()
  const pickers = createRequestPickers(desk)
  const solve = { label: "Mark as solved", icon: Check, run: () => pickers.setStatus([props.row], "solved") }
  const step = (): Step | undefined => {
    const { row } = props
    if (row.status === "closed") return undefined
    if (!props.asAgent) {
      if (row.status === "solved")
        return { label: "Reopen", icon: RotateCcw, keyName: "R", run: () => props.compose("reply") }
      if (row.status === "waiting")
        return { label: "Reply", icon: Reply, keyName: "R", run: () => props.compose("reply") }
      return solve
    }
    if (row.status === "solved")
      return { label: "Reopen", icon: RotateCcw, run: () => pickers.setStatus([row], "open") }
    if (row.assigneeId === null)
      return { label: "Assign to me", icon: Plus, keyName: "I", run: () => pickers.assignToMe([row]) }
    return { ...solve, keyName: "E" }
  }
  return (
    <Show when={step()}>
      {(next) => (
        <Tooltip content={next().keyName === undefined ? next().label : `${next().label} (${next().keyName})`}>
          {(trigger) => (
            <IconButton
              {...trigger()}
              class={styles.round}
              size="sm"
              variant="subtle"
              colorPalette="gray"
              aria-label={next().label}
              onClick={() => next().run()}
            >
              <Dynamic component={next().icon} />
            </IconButton>
          )}
        </Tooltip>
      )}
    </Show>
  )
}
