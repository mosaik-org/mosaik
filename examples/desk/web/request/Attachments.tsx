import { Button, IconButton } from "@mosaik/mosaik-ui"
import { errorMessage, formatBytes, toast, uploadFile } from "@mosaik/sdk/client"
import { css } from "@mosaik/sdk/css"
import { useQuery, useQueryClient } from "@tanstack/solid-query"
import Paperclip from "lucide-solid/icons/paperclip"
import X from "lucide-solid/icons/x"
import { createSignal, For, Show, Suspense } from "solid-js"
import { ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, type RequestId } from "../../api"
import { attachmentsQuery, attachmentUrl, attachUrl, deskApi } from "../queries"

const styles = {
  root: css({ display: "flex", flexDirection: "column", gap: "1", minW: "0" }),
  label: css({ fontSize: "xs", color: "fg.muted", px: { lg: "2" }, pt: { lg: "2" } }),
  row: css({ display: "flex", alignItems: "center", gap: "1", px: { lg: "2" }, minH: "7", minW: "0" }),
  name: css({
    flex: "1",
    minW: "0",
    truncate: true,
    fontSize: "sm",
    color: "fg.default",
    _hover: { textDecoration: "underline" },
  }),
  size: css({ fontSize: "xs", color: "fg.muted", flexShrink: "0" }),
  input: css({ srOnly: true }),
  add: css({ justifyContent: "flex-start" }),
}

/** A request's files: open them, add one, and for people working on it, remove one. */
export const Attachments = (props: { id: RequestId; mayAdd: boolean; mayRemove: boolean }) => {
  const client = useQueryClient()
  const attachments = useQuery(() => attachmentsQuery(props.id))
  const [uploading, setUploading] = createSignal(false)
  let picker: HTMLInputElement | undefined

  const refresh = () => client.invalidateQueries({ queryKey: deskApi.requests.attachments.key() })

  const upload = async (file: File) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("That file is too big", "Attach something under 10 MB.")
      return
    }
    setUploading(true)
    try {
      await uploadFile(attachUrl(props.id), file)
      toast.success(`${file.name} was attached`)
      void refresh()
    } catch (error) {
      toast.error("Could not attach the file", errorMessage(error))
    } finally {
      setUploading(false)
    }
  }

  const remove = async (name: string) => {
    try {
      await deskApi.requests.detach.call({ params: { id: props.id, name } })
      toast.success(`${name} was removed`)
      void refresh()
    } catch (error) {
      toast.error("Could not remove the file", errorMessage(error))
    }
  }

  return (
    <div class={styles.root}>
      <div class={styles.label}>Files</div>
      <Suspense>
        <For each={attachments.data ?? []}>
          {(attachment) => (
            <div class={styles.row}>
              <a
                class={styles.name}
                href={attachmentUrl(props.id, attachment.name, true)}
                target="_blank"
                rel="noreferrer"
              >
                {attachment.name}
              </a>
              <span class={styles.size}>{formatBytes(attachment.size)}</span>
              <Show when={props.mayRemove}>
                <IconButton
                  size="2xs"
                  variant="plain"
                  aria-label={`Remove ${attachment.name}`}
                  onClick={() => void remove(attachment.name)}
                >
                  <X />
                </IconButton>
              </Show>
            </div>
          )}
        </For>
      </Suspense>
      <Show when={props.mayAdd}>
        <input
          ref={picker}
          class={styles.input}
          type="file"
          tabIndex={-1}
          aria-hidden="true"
          accept={ATTACHMENT_TYPES.join(",")}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ""
            if (file !== undefined) void upload(file)
          }}
        />
        <Button class={styles.add} size="sm" variant="plain" loading={uploading()} onClick={() => picker?.click()}>
          <Paperclip />
          Attach a file
        </Button>
      </Show>
    </div>
  )
}
