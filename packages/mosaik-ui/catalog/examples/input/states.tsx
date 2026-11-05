import { Input } from "@mosaik/mosaik-ui"
import { input } from "styled-system/recipes"
import { Matrix } from "../../showcase"

const STATES = ["normal", "disabled", "read only", "invalid"] as const

/** Every variant in each state it can be in. */
export const App = () => (
  <Matrix rows={input.variantMap.variant} columns={STATES}>
    {(variant, state) => (
      <Input
        variant={variant}
        value="Value"
        aria-label={`${variant}, ${state}`}
        width="36"
        disabled={state === "disabled"}
        readOnly={state === "read only"}
        aria-invalid={state === "invalid"}
      />
    )}
  </Matrix>
)
