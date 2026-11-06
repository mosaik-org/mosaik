import { Tabs } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/sdk/css"
import { useSearchParams } from "@mosaik/sdk/portal"
import { useCan } from "@mosaik/sdk/solid"
import { Navigate } from "@tanstack/solid-router"
import { Schema } from "effect"
import { Show } from "solid-js"
import { desk } from "../../manifest"
import { Deadlines } from "../setup/Deadlines"
import { Queues } from "../setup/Queues"
import { SavedReplies } from "../setup/SavedReplies"

const SetupSearch = Schema.Struct({ tab: Schema.optional(Schema.Literals(["queues", "deadlines", "replies"])) })

const styles = { content: css({ pt: "4" }) }

/** How the desk works: where requests go, how fast they are due, and what agents can answer with. */
export default function Setup() {
  const can = useCan()
  const [search, setSearch] = useSearchParams(SetupSearch)
  return (
    <Show when={can(desk.perm("configure"))} fallback={<Navigate to="/desk" replace />}>
      <Tabs.Root
        value={search().tab ?? "queues"}
        onValueChange={(details) =>
          setSearch((previous) => ({ ...previous, tab: details.value as "queues" | "deadlines" | "replies" }))
        }
      >
        <Tabs.List>
          <Tabs.Trigger value="queues">Queues</Tabs.Trigger>
          <Tabs.Trigger value="deadlines">Deadlines</Tabs.Trigger>
          <Tabs.Trigger value="replies">Saved replies</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content class={styles.content} value="queues">
          <Queues />
        </Tabs.Content>
        <Tabs.Content class={styles.content} value="deadlines">
          <Deadlines />
        </Tabs.Content>
        <Tabs.Content class={styles.content} value="replies">
          <SavedReplies />
        </Tabs.Content>
      </Tabs.Root>
    </Show>
  )
}
