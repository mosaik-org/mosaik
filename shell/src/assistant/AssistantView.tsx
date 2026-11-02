import { AssistantPage, openPanel } from "@mosaik/assistant/web"
import { searchValidator } from "@mosaik/web-kit"
import { useNavigate } from "@tanstack/solid-router"
import { Schema } from "effect"

/** `from`: the page the person opened the full view from, to go back to with the conversation beside it. */
export const AssistantSearch = searchValidator(Schema.Struct({ from: Schema.optional(Schema.String) }))

/** A local path only: `from` comes from the URL, so never another site. */
const localPath = (path: string | undefined) => (path?.startsWith("/") && !path.startsWith("//") ? path : undefined)

export const AssistantView = (props: { readonly conversation: string | null; readonly from: string | undefined }) => {
  const navigate = useNavigate()
  const from = () => localPath(props.from)
  return (
    <AssistantPage
      conversation={props.conversation}
      onSelect={(conversation) =>
        void navigate(
          conversation === null
            ? { to: "/assistant", search: { from: from() } }
            : { to: "/assistant/$conversation", params: { conversation }, search: { from: from() } },
        )
      }
      onBack={
        from() === undefined
          ? undefined
          : () => {
              openPanel(props.conversation)
              void navigate({ href: from() as string })
            }
      }
    />
  )
}
