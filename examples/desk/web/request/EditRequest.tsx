import { createForm } from "@mosaik/sdk/solid"
import { Button, Modal, TextareaField, TextField } from "@mosaik/ui"
import { css } from "@mosaik/web-sdk/css"
import { Schema } from "effect"
import { createEffect, on } from "solid-js"
import { NewRequest, type RequestRow } from "../../api"
import { useDesk } from "../context"

const EditedRequest = Schema.Struct({ title: NewRequest.fields.title, body: NewRequest.fields.body })

const styles = { form: css({ display: "flex", flexDirection: "column", gap: "4" }) }

/** Changing what a request says, for the person who asked and the people working on it. */
export const EditRequestDialog = (props: { row: RequestRow; open: boolean; onOpenChange: (open: boolean) => void }) => {
  const desk = useDesk()
  const form = createForm({
    schema: EditedRequest,
    initial: { title: props.row.title, body: props.row.body },
    onSubmit: async (change) => {
      props.onOpenChange(false)
      await desk.actions.edit([{ id: props.row.id, change }], "Request updated")
    },
  })

  createEffect(
    on(
      () => props.open,
      (open) => {
        if (open) form.reset({ title: props.row.title, body: props.row.body })
      },
    ),
  )

  return (
    <Modal
      open={props.open}
      onOpenChange={(details) => props.onOpenChange(details.open)}
      title="Edit request"
      footer={
        <>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="desk-edit-request" loading={form.submitting()}>
            Save
          </Button>
        </>
      }
    >
      <form id="desk-edit-request" noValidate class={styles.form} onSubmit={form.submit}>
        <TextField label="Title" required {...form.field("title")} />
        <TextareaField label="Details" required rows={6} autoresize {...form.field("body")} />
      </form>
    </Modal>
  )
}
