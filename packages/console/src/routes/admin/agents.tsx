import { type AgentConnection, admin } from "@mosaik/auth/contract"
import { formatDateTime } from "@mosaik/client"
import { Button, ConfirmDialog } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
import { createColumnHelper, DataTable } from "@mosaik/table"
import { QueryBoundary, useAction } from "@mosaik/web-kit"
import { useQuery } from "@tanstack/solid-query"
import { createFileRoute } from "@tanstack/solid-router"
import { createSignal } from "solid-js"
import { administration } from "../../api"

export const Route = createFileRoute("/_app/admin/agents")({
  staticData: {
    title: "AI clients",
    keywords: ["mcp", "ai", "assistant", "claude", "connections"],
    permission: admin.perm("users.manage"),
  },
  component: Agents,
})

const Disconnect = (props: { connection: AgentConnection }) => {
  const [open, setOpen] = createSignal(false)
  const disconnect = useAction(administration.agents.disconnect, {
    success: `${props.connection.client} disconnected`,
    invalidates: [administration],
  })
  return (
    <>
      <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
        Disconnect
      </Button>
      <ConfirmDialog
        open={open()}
        onOpenChange={setOpen}
        title={`Disconnect ${props.connection.client}?`}
        description={`It can no longer act for ${props.connection.user.email}, until they connect it again.`}
        confirmLabel="Disconnect"
        tone="danger"
        loading={disconnect.pending()}
        onConfirm={async () => {
          if (await disconnect.run({ params: { id: props.connection.id } })) setOpen(false)
        }}
      />
    </>
  )
}

const column = createColumnHelper<AgentConnection>()

const columns = column.columns([
  column.accessor((connection) => connection.user.email, { id: "user", header: "Person" }),
  column.accessor("client", { header: "AI client" }),
  column.accessor("clientId", {
    header: "Client id",
    enableSorting: false,
    cell: (info) => <span class={css({ fontFamily: "mono", fontSize: "xs" })}>{info.getValue()}</span>,
  }),
  column.accessor("createdAt", { header: "Connected", cell: (info) => formatDateTime(info.getValue()) }),
  column.accessor("lastUsedAt", { header: "Last used", cell: (info) => formatDateTime(info.getValue()) }),
  column.display({ id: "actions", header: "", cell: (info) => <Disconnect connection={info.row.original} /> }),
])

/** AI clients people connected to Mosaik's MCP server; each acts as its person, until disconnected. */
function Agents() {
  const connections = useQuery(() => administration.agents.list.query())
  return (
    <QueryBoundary query={connections}>
      {() => (
        <DataTable
          columns={columns}
          data={connections.data ?? []}
          getRowId={(connection) => connection.id}
          emptyMessage="Nobody has connected an AI client."
        />
      )}
    </QueryBoundary>
  )
}
