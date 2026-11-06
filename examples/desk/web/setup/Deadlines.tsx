import { NumberField, Table } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/sdk/css"
import { useAction } from "@mosaik/sdk/solid"
import { QueryBoundary } from "@mosaik/sdk/ui"
import { useQuery } from "@tanstack/solid-query"
import { For } from "solid-js"
import { DeadlineRule, PRIORITY_LABELS } from "../../api"
import { PriorityIcon } from "../components/PriorityIcon"
import { deadlinesQuery, deskApi } from "../queries"

const styles = {
  stack: css({ display: "flex", flexDirection: "column", gap: "4" }),
  lead: css({ fontSize: "sm", color: "fg.muted" }),
  priority: css({ display: "flex", alignItems: "center", gap: "2", fontWeight: "medium", color: "fg.default" }),
  hours: css({ width: "28" }),
}

const toHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100

/** How fast each priority is due, in hours of the clock running. Saved as it changes; it applies from now on. */
export const Deadlines = () => {
  const rules = useQuery(deadlinesQuery)
  const save = useAction(deskApi.setup.setDeadline, {
    success: (rule) => `${PRIORITY_LABELS[rule.priority]} deadlines saved`,
    failure: "That was not saved",
    invalidates: [deskApi.directory.deadlines],
  })

  const change = (rule: DeadlineRule, field: "respondMinutes" | "resolveMinutes", hours: number | null) => {
    if (hours === null || hours <= 0) return
    const minutes = Math.round(hours * 60)
    if (minutes === rule[field]) return
    void save.run({ payload: new DeadlineRule({ ...rule, [field]: minutes }) })
  }

  return (
    <div class={styles.stack}>
      <p class={styles.lead}>
        How fast each priority must be answered and solved. The clock stops while waiting for the person who asked.
        Requests already sent keep the deadlines they were given.
      </p>
      <QueryBoundary query={rules}>
        {(list) => (
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.Header>Priority</Table.Header>
                <Table.Header>Answer within (hours)</Table.Header>
                <Table.Header>Solve within (hours)</Table.Header>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              <For each={list()}>
                {(rule) => (
                  <Table.Row>
                    <Table.Cell>
                      <span class={styles.priority}>
                        <PriorityIcon priority={rule.priority} />
                        {PRIORITY_LABELS[rule.priority]}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <NumberField
                        class={styles.hours}
                        aria-label={`Answer ${rule.priority} requests within, in hours`}
                        min={0.25}
                        step={0.25}
                        value={toHours(rule.respondMinutes)}
                        onValueChange={(hours) => change(rule, "respondMinutes", hours)}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <NumberField
                        class={styles.hours}
                        aria-label={`Solve ${rule.priority} requests within, in hours`}
                        min={0.25}
                        step={0.25}
                        value={toHours(rule.resolveMinutes)}
                        onValueChange={(hours) => change(rule, "resolveMinutes", hours)}
                      />
                    </Table.Cell>
                  </Table.Row>
                )}
              </For>
            </Table.Body>
          </Table.Root>
        )}
      </QueryBoundary>
    </div>
  )
}
