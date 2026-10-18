import { Chart, donutChartOption, lineChartOption } from "@mosaik/sdk/charts"
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from "@mosaik/sdk/client"
import { css } from "@mosaik/sdk/css"
import { useSearchParams } from "@mosaik/sdk/portal"
import { Card, CardHeader, QueryBoundary, QueryFreshness, Select, Stat } from "@mosaik/sdk/ui"
import { useQuery } from "@tanstack/solid-query"
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
        <Select
          items={RANGES}
          value={String(days())}
          onValueChange={(value) => setSearch(() => ({ days: Number(value) }))}
          size="sm"
          class={css({ width: "44" })}
        />
      </div>

      <div class={styles.stats}>
        <Stat
          label="Revenue"
          loading={summary.isPending}
          value={formatCurrency(summary.data?.data.revenueCents ?? 0)}
        />
        <Stat label="Orders" loading={summary.isPending} value={formatNumber(summary.data?.data.orders ?? 0)} />
        <Stat
          label="Average order"
          loading={summary.isPending}
          value={formatCurrency(summary.data?.data.averageOrderCents ?? 0)}
        />
        <Stat
          label="Refund rate"
          loading={summary.isPending}
          value={formatPercent(summary.data?.data.refundRate ?? 0)}
        />
      </div>

      <QueryBoundary query={summary}>
        {(data) => (
          <div class={styles.charts}>
            <Card>
              <CardHeader title="Revenue and orders" description="Daily, excluding cancelled and refunded orders" />
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
            </Card>
            <Card>
              <CardHeader title="Revenue by region" />
              <Chart
                option={donutChartOption({
                  data: data().data.byRegion.map((r) => ({ name: r.region, value: r.revenueCents })),
                  valueFormatter: (cents) => formatCurrency(cents),
                })}
              />
            </Card>
          </div>
        )}
      </QueryBoundary>
    </div>
  )
}
