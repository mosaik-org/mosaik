import { DatePickerField, DateRangePickerField, type IsoDateRange } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const [due, setDue] = createSignal<string | null>("2026-10-19")
  const [period, setPeriod] = createSignal<IsoDateRange | null>(null)
  return (
    <Stack gap="5" maxW="md">
      <DatePickerField label="Due date" value={due()} onValueChange={setDue} helperText={`Value: ${due() ?? "none"}`} />
      <DateRangePickerField
        label="Period"
        value={period()}
        onValueChange={setPeriod}
        helperText={`Value: ${period()?.join(" to ") ?? "none"}`}
      />
      <DatePickerField label="Weekdays only" isDateUnavailable={(date) => [0, 6].includes(new Date(date).getDay())} />
    </Stack>
  )
}
