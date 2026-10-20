import { Button, FileUploadField, IconButton, Modal, Progress } from "@mosaik/mosaik-ui"
import { errorMessage, formatBytes, formatRelativeTime, toast, uploadFile } from "@mosaik/sdk/client"
import { css } from "@mosaik/sdk/css"
import { useAction, useCan } from "@mosaik/sdk/solid"
import { QueryBoundary } from "@mosaik/sdk/ui"
import { useQuery, useQueryClient } from "@tanstack/solid-query"
import Trash from "lucide-solid/icons/trash"
import { createSignal, For, Show } from "solid-js"
import { ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, type Order } from "../../api"
import { sales } from "../../manifest"
import { salesApi } from "../queries"

const styles = {
  stack: css({ display: "flex", flexDirection: "column", gap: "4" }),
  list: css({ display: "flex", flexDirection: "column" }),
  row: css({
    display: "flex",
    alignItems: "center",
    gap: "3",
    py: "2",
    borderBottomWidth: "1px",
    borderColor: "border",
    _last: { borderBottomWidth: "0" },
  }),
  name: css({
    flex: "1",
    minW: "0",
    truncate: true,
    color: "accent.plain.fg",
    _hover: { textDecoration: "underline" },
  }),
  meta: css({ fontSize: "xs", color: "fg.muted", flexShrink: "0" }),
  muted: css({ fontSize: "sm", color: "fg.muted" }),
}

/** Shown in the browser rather than downloaded (the backend allows it for these only). */
const viewable = (type: string) => type === "application/pdf" || type.startsWith("image/")

/**
 * An order's attachments: download or view them, and for people who may edit orders, attach a
 * PDF or an image (Sales checks it; the platform stores it within Sales' limit) or remove one.
 */
export const AttachmentsDialog = (props: { order: Order; open: boolean; onOpenChange: (open: boolean) => void }) => {
  const can = useCan()
  const queryClient = useQueryClient()
  const attachments = useQuery(() => ({
    ...salesApi.orders.attachments.query({ params: { id: props.order.id } }),
    enabled: props.open,
  }))
  const [files, setFiles] = createSignal<ReadonlyArray<File>>([])
  const [progress, setProgress] = createSignal<number>()
  const detach = useAction(salesApi.orders.detach, {
    success: (_, request) => `${request.params.name} was removed`,
    invalidates: [salesApi.orders.attachments],
  })
  const href = (name: string, inline = false) =>
    `${sales.apiPrefix}/orders/${props.order.id}/attachments/${encodeURIComponent(name)}${inline ? "?inline=true" : ""}`

  const upload = async () => {
    const [file] = files()
    if (file === undefined) return
    setProgress(0)
    try {
      await uploadFile(`${sales.apiPrefix}/orders/${props.order.id}/attachments`, file, { onProgress: setProgress })
      toast.success(`${file.name} was attached`, props.order.number)
      setFiles([])
      void queryClient.invalidateQueries({ queryKey: salesApi.orders.attachments.key() })
    } catch (error) {
      toast.error("Could not attach the file", errorMessage(error))
    } finally {
      setProgress(undefined)
    }
  }

  return (
    <Modal open={props.open} onOpenChange={props.onOpenChange} title={`Attachments of ${props.order.number}`}>
      <div class={styles.stack}>
        <QueryBoundary query={attachments}>
          {(list) => (
            <Show when={list().length > 0} fallback={<p class={styles.muted}>Nothing is attached yet.</p>}>
              <div class={styles.list}>
                <For each={list()}>
                  {(attachment) => (
                    <div class={styles.row}>
                      <a class={styles.name} href={href(attachment.name)} download={attachment.name}>
                        {attachment.name}
                      </a>
                      <span class={styles.meta}>
                        {`${formatBytes(attachment.size)} · ${formatRelativeTime(attachment.uploadedAt)}`}
                      </span>
                      <Show when={viewable(attachment.contentType)}>
                        <a href={href(attachment.name, true)} target="_blank" rel="noopener">
                          <Button variant="plain" size="xs">
                            View
                          </Button>
                        </a>
                      </Show>
                      <Show when={can(sales.perm("orders.edit"))}>
                        <IconButton
                          variant="plain"
                          size="xs"
                          aria-label={`Remove ${attachment.name}`}
                          disabled={detach.pending()}
                          onClick={() => void detach.run({ params: { id: props.order.id, name: attachment.name } })}
                        >
                          <Trash size={14} />
                        </IconButton>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          )}
        </QueryBoundary>
        <Show when={can(sales.perm("orders.edit"))}>
          <FileUploadField
            label="Attach a file"
            helperText={`A PDF or an image, up to ${formatBytes(MAX_ATTACHMENT_BYTES)}.`}
            accept={[...ATTACHMENT_TYPES]}
            maxFileSize={MAX_ATTACHMENT_BYTES}
            files={files()}
            onFilesChange={setFiles}
            disabled={progress() !== undefined}
          />
          <Show when={progress()}>
            {(sent) => (
              <Progress.Root value={Math.round(sent() * 100)}>
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
            )}
          </Show>
          <Button disabled={files().length === 0} loading={progress() !== undefined} onClick={() => void upload()}>
            Attach
          </Button>
        </Show>
      </div>
    </Modal>
  )
}
