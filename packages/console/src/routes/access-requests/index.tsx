import { usePrincipal } from "@mosaik/auth/web"
import { EmptyState } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { PageTitle, searchValidator } from "@mosaik/web-kit"
import { createFileRoute } from "@tanstack/solid-router"
import { Schema } from "effect"
import Inbox from "lucide-solid/icons/inbox"
import { Show } from "solid-js"
import { managesAnyApp } from "../../access/queries"
import { AccessRequests } from "../../access/Requests"

const RequestsSearch = Schema.Struct({ answered: Schema.optional(Schema.Boolean) })

/** Requests for access to every app the user manages: the apps they own, or all of them for admins. */
export const Route = createFileRoute("/_app/access-requests/")({
  staticData: { title: "Access requests", keywords: ["approve", "decline", "owner", "permission"] },
  validateSearch: searchValidator(RequestsSearch),
  component: Requests,
})

function Requests() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const principal = usePrincipal()

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "6" })}>
      <PageTitle title="Access requests" icon={<Inbox size={18} />} />
      <Show
        when={managesAnyApp(principal())}
        fallback={
          <EmptyState
            icon={<Inbox size={32} />}
            title="You don't decide about any app"
            description="Each app's owners answer its requests, or the administrators when it has none."
          />
        }
      >
        <AccessRequests
          answered={search().answered === true}
          onAnsweredChange={(answered) => void navigate({ search: { answered: answered || undefined } })}
        />
      </Show>
    </div>
  )
}
