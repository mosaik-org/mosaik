import { errorMessage, toast } from "@mosaik/client"
import type { AnyApp } from "@mosaik/core"
import { Button, Modal, TextField } from "@mosaik/mosaik-ui"
import { useMutation } from "@tanstack/solid-query"
import { createEffect, createSignal, on, Show } from "solid-js"
import { categoryOf, setCategoryOverride } from "../apps"
import { portalApi } from "../portalApi"
import { DEFAULT_CATEGORY } from "./filter"

/** For the app's owners and admins: lists it under another category, or back under its own. */
export const CategoryDialog = (props: {
  app: AnyApp
  categories: ReadonlyArray<string>
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const [category, setCategory] = createSignal("")
  createEffect(
    on(
      () => props.open,
      (open) => open && setCategory(categoryOf(props.app)),
    ),
  )
  const own = () => props.app.portal.category ?? DEFAULT_CATEGORY

  const save = useMutation(() => ({
    mutationFn: (value: string | null) =>
      portalApi((client) =>
        client.directory.setCategory({ params: { id: props.app.id }, payload: { category: value } }),
      ).then(() => value),
    onSuccess: (value: string | null) => {
      setCategoryOverride(props.app.id, value)
      toast.success("Category changed", `${props.app.name} is listed under ${value ?? own()}.`)
      props.onOpenChange(false)
    },
    onError: (error: unknown) => toast.error("Could not change the category", errorMessage(error)),
  }))

  const submit = () => {
    const value = category().trim()
    // Choosing the app's own category drops the override, so later app updates apply again.
    save.mutate(value === "" || value === own() ? null : value)
  }

  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Category of ${props.app.name}`}
      description="Where the app is listed in All apps, for everyone."
      footer={
        <>
          <Show when={categoryOf(props.app) !== own()}>
            <Button variant="plain" disabled={save.isPending} onClick={() => save.mutate(null)}>
              Use the app's own ({own()})
            </Button>
          </Show>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <TextField
        label="Category"
        value={category()}
        onValueChange={setCategory}
        suggestions={props.categories}
        maxLength={40}
      />
    </Modal>
  )
}
