import { NumberField, RangeSliderField, SliderField } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const [amount, setAmount] = createSignal<number | null>(1250)
  return (
    <Stack gap="6" maxW="md">
      <NumberField
        label="Amount"
        formatOptions={{ style: "currency", currency: "EUR" }}
        value={amount()}
        onValueChange={setAmount}
        helperText={`Value: ${amount() ?? "empty"}`}
      />
      <NumberField label="Quantity" min={1} max={10} defaultValue={1} />
      <SliderField label="Volume" showValue defaultValue={40} />
      <RangeSliderField
        label="Price"
        showValue
        min={0}
        max={1000}
        step={10}
        defaultValue={[200, 600]}
        format={(value) => `€${value}`}
        marks={[0, 250, 500, 750, 1000]}
      />
    </Stack>
  )
}
