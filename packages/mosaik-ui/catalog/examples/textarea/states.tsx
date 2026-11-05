import { Textarea } from "@mosaik/mosaik-ui"
import { textarea } from "styled-system/recipes"
import { Matrix } from "../../showcase"

const STATES = ["normal", "disabled", "read only", "invalid"] as const

/** Every variant in each state it can be in. */
export const App = () => (
  <Matrix rows={textarea.variantMap.variant} columns={STATES}>
    {(variant, state) => (
      <Textarea
        variant={variant}
        value="Value"
        aria-label={`${variant}, ${state}`}
        rows={2}
        width="36"
        disabled={state === "disabled"}
        readOnly={state === "read only"}
        aria-invalid={state === "invalid"}
      />
    )}
  </Matrix>
)
