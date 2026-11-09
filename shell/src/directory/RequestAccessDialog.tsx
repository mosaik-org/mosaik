import { usePrincipal } from "@mosaik/auth/web"
import { errorMessage, toast } from "@mosaik/client"
import { aboutQuery, RoleDetails } from "@mosaik/console"
import type { AnyApp } from "@mosaik/core"
import { css } from "@mosaik/styled-system/css"
import { Button, Modal, SelectField, TextareaField } from "@mosaik/ui"
import { QueryBoundary } from "@mosaik/web-kit"
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query"
import { createSignal, Show } from "solid-js"
import { platformApi } from "../platformApi"
import { workspaceKeys } from "../workspace/queries"

/** Asks an app's owners (or the admins, when it has none) for one of its roles. */
export const RequestAccessDialog = (props: { app: AnyApp; open: boolean; onOpenChange: (open: boolean) => void }) => {
  const principal = usePrincipal()
  const queryClient = useQueryClient()
  const about = useQuery(() => aboutQuery(props.app.id))
  const roles = () => (about.data?.app.roles ?? []).filter((role) => !role.stale)
  const [chosen, setChosen] = createSignal<string>()
  // The smallest role, until they pick another.
  const role = () => chosen() ?? roles()[0]?.id
  const [message, setMessage] = createSignal("")
  const owners = () => about.data?.owners ?? []

  const request = useMutation(() => ({
    mutationFn: () =>
      platformApi((client) =>
        client.access.request({
          payload: { app: props.app.id, role: role() ?? null, message: message().trim() || null },
        }),
      ),
    onSuccess: () => {
      toast.success(
        "Request sent",
        owners().length > 0
          ? `${props.app.name}'s owners will look at your request.`
          : `An administrator will look at your request for ${props.app.name}.`,
      )
      const user = principal().user
      if (user !== null) void queryClient.invalidateQueries({ queryKey: workspaceKeys.accessRequests(user.id) })
      setMessage("")
      props.onOpenChange(false)
    },
    onError: (error: unknown) => toast.error("Could not send the request", errorMessage(error)),
  }))

  return (
    <Modal
      open={props.open}
      onOpenChange={(details) => props.onOpenChange(details.open)}
      title={`Request access to ${props.app.name}`}
      description={
        owners().length > 0
          ? `${owners()
              .map((owner) => owner.name)
              .join(", ")} ${owners().length === 1 ? "decides" : "decide"} who can use it, and will be notified.`
          : "Administrators decide who can use it, and will be notified."
      }
      footer={
        <>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={request.isPending} disabled={about.isPending} onClick={() => request.mutate()}>
            Send request
          </Button>
        </>
      }
    >
      <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
        <QueryBoundary query={about}>
          {(about) => (
            <Show when={roles().length > 1}>
              <SelectField
                label="Role"
                options={roles().map((candidate) => ({ value: candidate.id, label: candidate.name }))}
                value={role() ?? ""}
                onValueChange={setChosen}
              />
              <Show when={roles().find((candidate) => candidate.id === role())}>
                {(selected) => <RoleDetails role={selected()} appName={about().app.name} access={about().app.access} />}
              </Show>
            </Show>
          )}
        </QueryBoundary>
        <TextareaField
          label="What do you need it for? (optional)"
          value={message()}
          onValueChange={setMessage}
          maxLength={500}
        />
      </div>
    </Modal>
  )
}
