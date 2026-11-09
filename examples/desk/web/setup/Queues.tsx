import { createForm, useAction } from "@mosaik/sdk/solid"
import { ActionMenu, Button, ConfirmDialog, EmptyState, IconButton, Modal, Table, TextField } from "@mosaik/ui"
import { css } from "@mosaik/web-sdk/css"
import { QueryBoundary } from "@mosaik/web-sdk/ui"
import { useQuery } from "@tanstack/solid-query"
import Ellipsis from "lucide-solid/icons/ellipsis"
import Inbox from "lucide-solid/icons/inbox"
import Pencil from "lucide-solid/icons/pencil"
import Plus from "lucide-solid/icons/plus"
import Trash from "lucide-solid/icons/trash"
import { createSignal, For, Show } from "solid-js"
import { type Queue, QueueInput } from "../../api"
import { deskApi, queuesQuery } from "../queries"

const styles = {
  stack: css({ display: "flex", flexDirection: "column", gap: "4" }),
  head: css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4" }),
  lead: css({ fontSize: "sm", color: "fg.muted" }),
  form: css({ display: "flex", flexDirection: "column", gap: "4" }),
  name: css({ fontWeight: "medium", color: "fg" }),
  clip: css({ maxW: "md", truncate: true }),
  actions: css({ width: "12", textAlign: "end" }),
}

const QueueDialog = (props: { queue: Queue | undefined; open: boolean; onClose: () => void }) => {
  const create = useAction(deskApi.setup.createQueue, { success: "Queue added", invalidates: [deskApi] })
  const update = useAction(deskApi.setup.updateQueue, { success: "Queue saved", invalidates: [deskApi] })
  const form = createForm({
    schema: QueueInput,
    initial: { name: props.queue?.name ?? "", description: props.queue?.description ?? "" },
    onSubmit: async (payload) => {
      if (props.queue === undefined) await create.submit({ payload })
      else await update.submit({ params: { id: props.queue.id }, payload })
      props.onClose()
    },
  })
  return (
    <Modal
      open={props.open}
      onOpenChange={(details) => {
        if (!details.open) props.onClose()
      }}
      title={props.queue === undefined ? "New queue" : `Edit ${props.queue.name}`}
      description="People choose a queue when they ask for something."
      footer={
        <>
          <Button variant="outline" onClick={props.onClose}>
            Cancel
          </Button>
          <Button type="submit" form="desk-queue" loading={form.submitting()}>
            Save
          </Button>
        </>
      }
    >
      <form id="desk-queue" noValidate class={styles.form} onSubmit={form.submit}>
        <TextField label="Name" required {...form.field("name")} />
        <TextField
          label="What it is for"
          helperText="Shown when choosing a queue, so people pick the right one."
          {...form.field("description")}
        />
        <Show when={form.error()}>{(error) => <p class={styles.lead}>{error()}</p>}</Show>
      </form>
    </Modal>
  )
}

export const Queues = () => {
  const queues = useQuery(queuesQuery)
  // `undefined`: closed. `null`: a new one.
  const [editing, setEditing] = createSignal<Queue | null | undefined>(undefined)
  const [removing, setRemoving] = createSignal<Queue>()
  const remove = useAction(deskApi.setup.removeQueue, {
    success: "Queue removed",
    failure: "That queue was not removed",
    invalidates: [deskApi],
  })

  return (
    <div class={styles.stack}>
      <div class={styles.head}>
        <p class={styles.lead}>Where requests go. Each is a team that handles a kind of them.</p>
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus />
          New queue
        </Button>
      </div>
      <QueryBoundary query={queues}>
        {(list) => (
          <Show
            when={list().length > 0}
            fallback={
              <EmptyState.Root>
                <EmptyState.Indicator>
                  <Inbox />
                </EmptyState.Indicator>
                <EmptyState.Content>
                  <EmptyState.Title>No queues yet</EmptyState.Title>
                  <EmptyState.Description>People need at least one to send a request.</EmptyState.Description>
                </EmptyState.Content>
                <EmptyState.Actions>
                  <Button onClick={() => setEditing(null)}>New queue</Button>
                </EmptyState.Actions>
              </EmptyState.Root>
            }
          >
            <Table.Root>
              <Table.Head>
                <Table.Row>
                  <Table.Header>Name</Table.Header>
                  <Table.Header>What it is for</Table.Header>
                  <Table.Header class={styles.actions} />
                </Table.Row>
              </Table.Head>
              <Table.Body>
                <For each={list()}>
                  {(queue) => (
                    <Table.Row>
                      <Table.Cell class={styles.name}>{queue.name}</Table.Cell>
                      <Table.Cell>{queue.description}</Table.Cell>
                      <Table.Cell class={styles.actions}>
                        <ActionMenu
                          trigger={(trigger) => (
                            <IconButton
                              {...trigger()}
                              size="xs"
                              variant="ghost"
                              aria-label={`Actions for ${queue.name}`}
                            >
                              <Ellipsis />
                            </IconButton>
                          )}
                          items={[
                            { value: "edit", label: "Edit", icon: <Pencil />, onSelect: () => setEditing(queue) },
                            {
                              value: "remove",
                              label: "Remove",
                              icon: <Trash />,
                              danger: true,
                              onSelect: () => setRemoving(queue),
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
        <QueueDialog queue={editing() ?? undefined} open onClose={() => setEditing(undefined)} />
      </Show>
      <ConfirmDialog
        open={removing() !== undefined}
        onOpenChange={(details) => {
          if (!details.open) setRemoving(undefined)
        }}
        title={`Remove ${removing()?.name}?`}
        message="Only a queue with no requests in it can be removed."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => {
          const queue = removing()
          if (queue !== undefined) void remove.run({ params: { id: queue.id } })
        }}
      />
    </div>
  )
}
