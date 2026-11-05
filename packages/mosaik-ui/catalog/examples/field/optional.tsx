import { Field, Input } from "@mosaik/mosaik-ui"
import { css } from "styled-system/css"

const optional = css({ color: "fg.muted", fontWeight: "normal" })

export const App = () => {
  return (
    <Field.Root>
      <Field.Label>
        Phone
        <Field.RequiredIndicator fallback={<span class={optional}>(optional)</span>} />
      </Field.Label>
      <Input placeholder="+1 555 0100" />
    </Field.Root>
  )
}
