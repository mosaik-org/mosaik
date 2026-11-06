import { ActionMenu, Button, ConfirmDialog, EmptyState, IconButton, Modal, Table, TextField } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/sdk/css"
import { createForm, useAction } from "@mosaik/sdk/solid"
import { QueryBoundary } from "@mosaik/sdk/ui"
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
  name: css({ fontWeight: "medium", color: "fg.default" }),
  clip: css({ maxW: "md", truncate: true }),
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
      onOpenChange={(open) => !open && props.onClose()}
      title={props.queue === undefined ? "New queue" : `Edit ${props.queue.name}`}
      description="People choose a queue when they ask for something."
      footer={
        <>
          <Button variant="outline" colorPalette="gray" onClick={props.onClose}>
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
              <EmptyState
                icon={<Inbox />}
                title="No queues yet"
                description="People need at least one to send a request."
                action={<Button onClick={() => setEditing(null)}>New queue</Button>}
              />
            }
          >
            <Table.Root>
              <Table.Head>
                <Table.Row>
                  <Table.Header>Name</Table.Header>
                  <Table.Header>What it is for</Table.Header>
                  <Table.Header w="12" />
                </Table.Row>
              </Table.Head>
              <Table.Body>
                <For each={list()}>
                  {(queue) => (
                    <Table.Row>
                      <Table.Cell class={styles.name}>{queue.name}</Table.Cell>
                      <Table.Cell>{queue.description}</Table.Cell>
                      <Table.Cell textAlign="end">
                        <ActionMenu
                          trigger={(trigger) => (
                            <IconButton
                              {...trigger()}
                              size="xs"
                              variant="plain"
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
        onOpenChange={(open) => !open && setRemoving(undefined)}
        title={`Remove ${removing()?.name}?`}
        description="Only a queue with no requests in it can be removed."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => {
          const queue = removing()
          setRemoving(undefined)
          if (queue !== undefined) void remove.run({ params: { id: queue.id } })
        }}
      />
    </div>
  )
}
