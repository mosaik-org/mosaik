import { defineTokens } from "@pandacss/dev"

/**
 * How things move: `enter` for what appears (fast, then settling into place), `exit` for what
 * leaves (gathering speed as it goes), `standard` for a change within a control (a switch's
 * thumb, a tab's underline). Durations are short: about 150ms for small things, 200–300ms for
 * dialogs and drawers, and leaving is quicker than arriving.
 */
export const easings = defineTokens.easings({
  enter: { value: "cubic-bezier(0.05, 0.7, 0.1, 1)" },
  exit: { value: "cubic-bezier(0.3, 0, 0.8, 0.15)" },
  standard: { value: "cubic-bezier(0.2, 0, 0, 1)" },
})
