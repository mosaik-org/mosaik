import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from "@mosaik/sdk/client"
import { useSearchParams } from "@mosaik/sdk/router"
import { Card, SelectField, Skeleton, Stat } from "@mosaik/ui"
import { Chart, donutChartOption, lineChartOption } from "@mosaik/web-sdk/charts"
import { css } from "@mosaik/web-sdk/css"
import { QueryBoundary, QueryFreshness } from "@mosaik/web-sdk/ui"
import { useQuery } from "@tanstack/solid-query"
import { Index } from "solid-js"
import { SUMMARY_DEFAULTS, SummarySearch } from "../../api"
import { summaryQuery } from "../queries"

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const

const styles = {
  toolbar: css({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "4", flexWrap: "wrap" }),
  stats: css({
    display: "grid",
    gap: "4",
    gridTemplateColumns: { base: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" },
  }),
  charts: css({ display: "grid", gap: "4", gridTemplateColumns: { base: "1fr", lg: "2fr 1fr" } }),
}

/** Revenue and orders over a chosen period (`?days=`). */
export default function Overview() {
  const [search, setSearch] = useSearchParams(SummarySearch)
  const days = () => search().days ?? SUMMARY_DEFAULTS.days
  const summary = useQuery(() => summaryQuery(days()))

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
      <div class={styles.toolbar}>
        <QueryFreshness query={summary} staleAfter="5 minutes" />
        <SelectField
          options={RANGES}
          value={String(days())}
          onValueChange={(value) => setSearch(() => ({ days: Number(value) }))}
          class={css({ width: "44" })}
        />
      </div>

      <div class={styles.stats} aria-busy={summary.isPending}>
        <Index
          each={[
            { label: "Revenue", value: formatCurrency(summary.data?.data.revenueCents ?? 0) },
            { label: "Orders", value: formatNumber(summary.data?.data.orders ?? 0) },
            { label: "Average order", value: formatCurrency(summary.data?.data.averageOrderCents ?? 0) },
            { label: "Refund rate", value: formatPercent(summary.data?.data.refundRate ?? 0) },
          ]}
        >
          {(stat) => (
            <Card.Root>
              <Card.Body>
                <Stat.Root>
                  <Stat.Label>{stat().label}</Stat.Label>
                  {/* Until the summary comes, a shape the size of a zero holds the number's place. */}
                  <Skeleton loading={summary.isPending} alignSelf="flex-start">
                    <Stat.Value>{stat().value}</Stat.Value>
                  </Skeleton>
                </Stat.Root>
              </Card.Body>
            </Card.Root>
          )}
        </Index>
      </div>

      <QueryBoundary query={summary}>
        {(data) => (
          <div class={styles.charts}>
            <Card.Root>
              <Card.Header>
                <Card.Title>Revenue and orders</Card.Title>
                <Card.Description>Daily, excluding cancelled and refunded orders</Card.Description>
              </Card.Header>
              <Card.Body gap="4">
                <Chart
                  loading={summary.isFetching}
                  option={lineChartOption({
                    categories: data().data.daily.map((d) => d.day),
                    series: [
                      { name: "Revenue", type: "bar", data: data().data.daily.map((d) => d.revenueCents) },
                      { name: "Orders", data: data().data.daily.map((d) => d.orders), yAxisIndex: 1 },
                    ],
                    valueFormatter: (cents) => formatCompactCurrency(cents),
                    secondaryValueFormatter: formatNumber,
                  })}
                />
              </Card.Body>
            </Card.Root>
            <Card.Root>
              <Card.Header>
                <Card.Title>Revenue by region</Card.Title>
              </Card.Header>
              <Card.Body gap="4">
                <Chart
                  option={donutChartOption({
                    data: data().data.byRegion.map((r) => ({ name: r.region, value: r.revenueCents })),
                    valueFormatter: (cents) => formatCurrency(cents),
                  })}
                />
              </Card.Body>
            </Card.Root>
          </div>
        )}
      </QueryBoundary>
    </div>
  )
}
