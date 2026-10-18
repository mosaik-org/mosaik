import { Chart, sparklineOption } from "@mosaik/charts"
import { formatRelativeTime } from "@mosaik/client"
import { createEventStream } from "@mosaik/client/solid"
import { css } from "@mosaik/styled-system/css"
import { Badge, Card } from "@mosaik/ui"
import { Freshness, QueryBoundary } from "@mosaik/web-kit"
import { useQuery } from "@tanstack/solid-query"
import { createFileRoute } from "@tanstack/solid-router"
import { DateTime } from "effect"
import CircleAlert from "lucide-solid/icons/circle-alert"
import CircleCheck from "lucide-solid/icons/circle-check"
import { For, Show } from "solid-js"
import { liveUrl, type ServiceState, type ServiceStatus, StatusSnapshot } from "../../api"
import { snapshotQuery } from "../queries"

export const Route = createFileRoute("/_app/status/")({
  staticData: { title: "Platform status", keywords: ["health", "uptime", "services"] },
  component: StatusPage,
})

const STATE = {
  up: { tone: "success", label: "Operational" },
  degraded: { tone: "warning", label: "Degraded" },
  down: { tone: "danger", label: "Down" },
  unknown: { tone: "neutral", label: "Checking…" },
} as const satisfies Record<ServiceState, { tone: string; label: string }>

const styles = {
  banner: css({
    display: "flex",
    alignItems: "center",
    gap: "3",
    px: "5",
    py: "4",
    borderRadius: "card",
    fontWeight: "medium",
    "&[data-healthy=true]": { bg: "success.subtle", color: "success.text" },
    "&[data-healthy=false]": { bg: "danger.subtle", color: "danger.text" },
  }),
  grid: css({
    display: "grid",
    gap: "4",
    gridTemplateColumns: { base: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" },
  }),
  name: css({ fontWeight: "semibold", textTransform: "capitalize" }),
  meta: css({ display: "flex", justifyContent: "space-between", fontSize: "xs", color: "fg.muted" }),
}

const ServiceCard = (props: { service: ServiceStatus }) => (
  <Card>
    <div class={css({ display: "flex", flexDirection: "column", gap: "3" })}>
      <div class={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
        <span class={styles.name}>{props.service.name}</span>
        <Badge tone={STATE[props.service.state].tone}>{STATE[props.service.state].label}</Badge>
      </div>
      <Chart height="56px" option={sparklineOption({ data: props.service.history })} />
      <div class={styles.meta}>
        <span>{props.service.latencyMs === null ? "No response" : `${props.service.latencyMs} ms`}</span>
        <Show when={props.service.checkedAt}>{(at) => <span>checked {formatRelativeTime(at())}</span>}</Show>
      </div>
    </div>
  </Card>
)

function StatusPage() {
  // Initial state from a regular request, then live updates over Server-Sent Events.
  const initial = useQuery(snapshotQuery)
  const live = createEventStream(liveUrl, StatusSnapshot)
  const services = () => (live.data() ?? initial.data)?.services ?? []
  const lastCheck = () =>
    services()
      .flatMap((service) => (service.checkedAt ? [DateTime.toEpochMillis(service.checkedAt)] : []))
      .reduce<number | undefined>((latest, at) => Math.max(latest ?? 0, at), undefined)
  const healthy = () => services().every((service) => service.state === "up" || service.state === "unknown")

  return (
    <QueryBoundary query={initial}>
      {() => (
        <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
          <div class={styles.banner} data-healthy={healthy()}>
            <Show when={healthy()} fallback={<CircleAlert size={20} />}>
              <CircleCheck size={20} />
            </Show>
            {healthy() ? "All systems operational" : "Some services are having problems"}
            <div class={css({ flex: "1" })} />
            <Freshness
              live={live.status() === "open"}
              at={lastCheck()}
              source="health checks every 5 seconds"
              staleAfter="30 seconds"
            />
          </div>
          <div class={styles.grid}>
            <For each={services()}>{(service) => <ServiceCard service={service} />}</For>
          </div>
        </div>
      )}
    </QueryBoundary>
  )
}
