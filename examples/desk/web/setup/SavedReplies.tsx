import {
  ActionMenu,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Modal,
  Table,
  TextareaField,
  TextField,
} from "@mosaik/mosaik-ui"
import { css } from "@mosaik/sdk/css"
import { createForm, useAction } from "@mosaik/sdk/solid"
import { QueryBoundary } from "@mosaik/sdk/ui"
import { useQuery } from "@tanstack/solid-query"
import Ellipsis from "lucide-solid/icons/ellipsis"
import MessageSquareText from "lucide-solid/icons/message-square-text"
import Pencil from "lucide-solid/icons/pencil"
import Plus from "lucide-solid/icons/plus"
import Trash from "lucide-solid/icons/trash"
import { createSignal, For, Show } from "solid-js"
import { type SavedReply, SavedReplyInput } from "../../api"
import { deskApi, savedRepliesQuery } from "../queries"

const styles = {
  stack: css({ display: "flex", flexDirection: "column", gap: "4" }),
  head: css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4" }),
  lead: css({ fontSize: "sm", color: "fg.muted" }),
  form: css({ display: "flex", flexDirection: "column", gap: "4" }),
  name: css({ fontWeight: "medium", color: "fg.default" }),
  clip: css({ maxW: "md", truncate: true }),
}

const SavedReplyDialog = (props: { reply: SavedReply | undefined; onClose: () => void }) => {
  const create = useAction(deskApi.setup.createSavedReply, { success: "Saved reply added", invalidates: [deskApi] })
  const update = useAction(deskApi.setup.updateSavedReply, { success: "Saved reply saved", invalidates: [deskApi] })
  const form = createForm({
    schema: SavedReplyInput,
    initial: { title: props.reply?.title ?? "", body: props.reply?.body ?? "" },
    onSubmit: async (payload) => {
      if (props.reply === undefined) await create.submit({ payload })
      else await update.submit({ params: { id: props.reply.id }, payload })
      props.onClose()
    },
  })
  return (
    <Modal
      open
      onOpenChange={(open) => !open && props.onClose()}
      title={props.reply === undefined ? "New saved reply" : "Edit saved reply"}
      footer={
        <>
          <Button variant="outline" colorPalette="gray" onClick={props.onClose}>
            Cancel
          </Button>
          <Button type="submit" form="desk-saved-reply" loading={form.submitting()}>
            Save
          </Button>
        </>
      }
    >
      <form id="desk-saved-reply" noValidate class={styles.form} onSubmit={form.submit}>
        <TextField label="Name" required helperText="How agents find it." {...form.field("title")} />
        <TextareaField label="Text" required rows={5} autoresize {...form.field("body")} />
      </form>
    </Modal>
  )
}

export const SavedReplies = () => {
  const replies = useQuery(savedRepliesQuery)
  const [editing, setEditing] = createSignal<SavedReply | null | undefined>(undefined)
  const [removing, setRemoving] = createSignal<SavedReply>()
  const remove = useAction(deskApi.setup.removeSavedReply, { success: "Saved reply removed", invalidates: [deskApi] })

  return (
    <div class={styles.stack}>
      <div class={styles.head}>
        <p class={styles.lead}>Texts agents answer with again and again, to use and adjust.</p>
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus />
          New saved reply
        </Button>
      </div>
      <QueryBoundary query={replies}>
        {(list) => (
          <Show
            when={list().length > 0}
            fallback={
              <EmptyState
                icon={<MessageSquareText />}
                title="No saved replies yet"
                description="Add the answers your team gives most often."
                action={<Button onClick={() => setEditing(null)}>New saved reply</Button>}
              />
            }
          >
            <Table.Root>
              <Table.Head>
                <Table.Row>
                  <Table.Header>Name</Table.Header>
                  <Table.Header>Text</Table.Header>
                  <Table.Header w="12" />
                </Table.Row>
              </Table.Head>
              <Table.Body>
                <For each={list()}>
                  {(reply) => (
                    <Table.Row>
                      <Table.Cell class={styles.name}>{reply.title}</Table.Cell>
                      <Table.Cell>
                        <div class={styles.clip}>{reply.body}</div>
                      </Table.Cell>
                      <Table.Cell textAlign="end">
                        <ActionMenu
                          trigger={(trigger) => (
                            <IconButton
                              {...trigger()}
                              size="xs"
                              variant="plain"
                              aria-label={`Actions for ${reply.title}`}
                            >
                              <Ellipsis />
                            </IconButton>
                          )}
                          items={[
                            { value: "edit", label: "Edit", icon: <Pencil />, onSelect: () => setEditing(reply) },
                            {
                              value: "remove",
                              label: "Remove",
                              icon: <Trash />,
                              danger: true,
                              onSelect: () => setRemoving(reply),
                            },
                          ]}
                        />
                      </Table.Cell>
                    </Table.Row>
                  )}
                </For>
              </Table.Body>
            </Table.Root>
          </Show>
        )}
      </QueryBoundary>
      <Show when={editing() !== undefined} keyed>
        <SavedReplyDialog reply={editing() ?? undefined} onClose={() => setEditing(undefined)} />
      </Show>
      <ConfirmDialog
        open={removing() !== undefined}
        onOpenChange={(open) => !open && setRemoving(undefined)}
        title={`Remove "${removing()?.title}"?`}
        description="This can't be undone."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => {
          const reply = removing()
          setRemoving(undefined)
          if (reply !== undefined) void remove.run({ params: { id: reply.id } })
        }}
      />
    </div>
  )
}
