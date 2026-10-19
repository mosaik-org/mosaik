import { CheckboxField, ComboboxField, RadioGroupField, SelectField, SwitchField } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"
import { Stack } from "styled-system/jsx"

const countries = ["Austria", "Belgium", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Poland"]

export const App = () => {
  const [status, setStatus] = createSignal<string | null>("open")
  return (
    <Stack gap="5" maxW="md">
      <SelectField
        label="Status"
        clearable
        items={[
          { label: "Open", value: "open" },
          { label: "In progress", value: "progress" },
          { label: "Closed", value: "closed", disabled: true },
        ]}
        value={status()}
        onValueChange={setStatus}
        helperText={`Value: ${status() ?? "none"}`}
      />
      <ComboboxField label="Country" placeholder="Type to search" items={countries} />
      <RadioGroupField
        label="Plan"
        items={["Free", "Team", "Enterprise"]}
        defaultValue="Team"
        orientation="horizontal"
      />
      <CheckboxField label="I accept the terms" errorText="Accept the terms to continue" />
      <SwitchField label="Email me about changes" defaultChecked helperText="At most once a day" />
    </Stack>
  )
}
