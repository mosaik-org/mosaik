import { Button, Modal, SelectField, TextareaField, TextField } from "@mosaik/mosaik-ui"
import { errorMessage, toast } from "@mosaik/sdk/client"
import { css } from "@mosaik/sdk/css"
import { createForm, useCan } from "@mosaik/sdk/solid"
import { useQuery, useQueryClient } from "@tanstack/solid-query"
import { useNavigate } from "@tanstack/solid-router"
import { createEffect, on, Show } from "solid-js"
import { NewRequest, PRIORITIES, PRIORITY_LABELS, type Priority, requestNumber } from "../api"
import { desk } from "../manifest"
import { deskApi, queuesQuery } from "./queries"

const styles = {
  form: css({ display: "flex", flexDirection: "column", gap: "4" }),
  error: css({ fontSize: "sm", color: "danger.plain.fg" }),
}

/** Asking for something: what about, and who should look at it. */
export const NewRequestDialog = (props: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const client = useQueryClient()
  const navigate = useNavigate()
  const can = useCan()
  const queues = useQuery(queuesQuery)
  const isAgent = () => can(desk.perm("requests.work"))
  const queueItems = () =>
    (queues.data ?? []).map((queue) => ({ value: String(queue.id), label: queue.name, description: queue.description }))

  const form = createForm({
    schema: NewRequest,
    initial: { title: "", body: "", queueId: 0, priority: "normal" as Priority },
    onSubmit: async (payload) => {
      const created = await deskApi.requests.create.call({ payload })
      void client.invalidateQueries({ queryKey: deskApi.requests.key() })
      toast.success(`${requestNumber(created.id)} was sent`)
      props.onOpenChange(false)
      // Where they can follow it: the person who asked sees it among theirs.
      void navigate({ to: isAgent() ? "/desk/all" : "/desk/mine", search: { open: created.id } as never })
    },
  })

  // Fresh each time, starting in the first queue.
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) return
        form.reset({
          title: "",
          body: "",
          queueId: queues.data?.[0]?.id ?? 0,
          priority: "normal",
        })
      },
    ),
  )

  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="New request"
      description="Tell us what you need. You'll see the answer under My requests."
      footer={
        <>
          <Button variant="outline" colorPalette="gray" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="desk-new-request" loading={form.submitting()}>
            Send request
          </Button>
        </>
      }
    >
      <form id="desk-new-request" noValidate class={styles.form} onSubmit={form.submit}>
        <TextField label="What is it about?" required {...form.field("title")} />
        <SelectField
          label="Who should look at it?"
          required
          items={queueItems()}
          name="queueId"
          value={String(form.values.queueId)}
          onValueChange={(value) => form.set("queueId", Number(value))}
          errorText={form.field("queueId").errorText}
        />
        <Show when={isAgent()}>
          <SelectField
            label="Priority"
            items={PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABELS[priority] }))}
            value={form.values.priority}
            onValueChange={(value) => {
              if (value !== null) form.set("priority", value)
            }}
          />
        </Show>
        <TextareaField label="Details" required rows={5} autoresize {...form.field("body")} />
        <Show when={form.error()}>{(error) => <p class={styles.error}>{errorMessage(error())}</p>}</Show>
      </form>
    </Modal>
  )
}
