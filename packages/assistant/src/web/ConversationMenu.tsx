import { useAction } from "@mosaik/client/solid"
import { ActionMenu, Button, ConfirmDialog, IconButton, Modal, TextField } from "@mosaik/mosaik-ui"
import Ellipsis from "lucide-solid/icons/ellipsis"
import Pencil from "lucide-solid/icons/pencil"
import Trash from "lucide-solid/icons/trash"
import { createSignal, type JSX } from "solid-js"
import type { ConversationSummary } from "../contract"
import { assistant } from "./api"

/**
 * A conversation's actions: renaming it and deleting it, each confirmed in a dialog. Shown beside
 * a conversation in the list and above the open one.
 */
export const ConversationMenu = (props: {
  readonly conversation: ConversationSummary
  /** The conversation was deleted (e.g. to leave it if it is open). */
  readonly onDeleted?: () => void
  readonly class?: string
}): JSX.Element => {
  const [renaming, setRenaming] = createSignal(false)
  const [deleting, setDeleting] = createSignal(false)
  const [title, setTitle] = createSignal("")
  const rename = useAction(assistant.assistant.rename, { success: "Conversation renamed", invalidates: [assistant] })
  const remove = useAction(assistant.assistant.remove, {
    success: "Conversation deleted",
    invalidates: [assistant],
    onSuccess: () => props.onDeleted?.(),
  })
  const save = async () => {
    const next = title().trim()
    if (next === "") return
    if (await rename.run({ params: { id: props.conversation.id }, payload: { title: next } })) setRenaming(false)
  }

  return (
    <>
      <ActionMenu
        trigger={(trigger) => (
          <IconButton
            variant="plain"
            size="2xs"
            class={props.class}
            aria-label={`Actions for ${props.conversation.title || "this conversation"}`}
            {...trigger()}
          >
            <Ellipsis size={14} />
          </IconButton>
        )}
        items={[
          {
            value: "rename",
            label: "Rename…",
            icon: <Pencil size={14} />,
            onSelect: () => {
              setTitle(props.conversation.title)
              setRenaming(true)
            },
          },
          {
            value: "delete",
            label: "Delete…",
            icon: <Trash size={14} />,
            danger: true,
            onSelect: () => setDeleting(true),
          },
        ]}
      />
      <Modal
        open={renaming()}
        onOpenChange={setRenaming}
        title="Rename the conversation"
        footer={
          <>
            <Button variant="plain" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button loading={rename.pending()} disabled={title().trim() === ""} onClick={() => void save()}>
              Save
            </Button>
          </>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <TextField label="Title" value={title()} onValueChange={setTitle} maxLength={120} />
        </form>
      </Modal>
      <ConfirmDialog
        open={deleting()}
        onOpenChange={setDeleting}
        title="Delete the conversation?"
        description="It is deleted for good, with everything in it. What the assistant changed in apps stays."
        confirmLabel="Delete"
        tone="danger"
        loading={remove.pending()}
        onConfirm={async () => {
          if (await remove.run({ params: { id: props.conversation.id } })) setDeleting(false)
        }}
      />
    </>
  )
}
