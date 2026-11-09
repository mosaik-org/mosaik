import { createForm, useAction } from "@mosaik/sdk/solid"
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
} from "@mosaik/ui"
import { css } from "@mosaik/web-sdk/css"
import { QueryBoundary } from "@mosaik/web-sdk/ui"
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
  name: css({ fontWeight: "medium", color: "fg" }),
  clip: css({ maxW: "md", truncate: true }),
  actions: css({ width: "12", textAlign: "end" }),
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
      onOpenChange={(details) => {
        if (!details.open) props.onClose()
      }}
      title={props.reply === undefined ? "New saved reply" : "Edit saved reply"}
      footer={
        <>
          <Button variant="outline" onClick={props.onClose}>
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
              <EmptyState.Root>
                <EmptyState.Indicator>
                  <MessageSquareText />
                </EmptyState.Indicator>
                <EmptyState.Content>
                  <EmptyState.Title>No saved replies yet</EmptyState.Title>
                  <EmptyState.Description>Add the answers your team gives most often.</EmptyState.Description>
                </EmptyState.Content>
                <EmptyState.Actions>
                  <Button onClick={() => setEditing(null)}>New saved reply</Button>
                </EmptyState.Actions>
              </EmptyState.Root>
            }
          >
            <Table.Root>
              <Table.Head>
                <Table.Row>
                  <Table.Header>Name</Table.Header>
                  <Table.Header>Text</Table.Header>
                  <Table.Header class={styles.actions} />
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
                      <Table.Cell class={styles.actions}>
                        <ActionMenu
                          trigger={(trigger) => (
                            <IconButton
                              {...trigger()}
                              size="xs"
                              variant="ghost"
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
        onOpenChange={(details) => {
          if (!details.open) setRemoving(undefined)
        }}
        title={`Remove "${removing()?.title}"?`}
        message="This can't be undone."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => {
          const reply = removing()
          if (reply !== undefined) void remove.run({ params: { id: reply.id } })
        }}
      />
    </div>
  )
}
