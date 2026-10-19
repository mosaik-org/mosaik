import { Button, CheckboxField, SelectField, TextField } from "@mosaik/mosaik-ui"
import { createSignal } from "solid-js"
import { createStore } from "solid-js/store"
import { HStack, Stack } from "styled-system/jsx"

/** A form with checks and errors after a submit attempt, with plain Solid state. */
export const App = () => {
  const [values, setValues] = createStore({ name: "", email: "", role: null as string | null, terms: false })
  const [tried, setTried] = createSignal(false)
  const [sent, setSent] = createSignal(false)
  const errors = () => ({
    name: values.name.trim() ? undefined : "Enter a name",
    email: /^[^\s@]+@[^\s@]+$/.test(values.email) ? undefined : "Enter an email address",
    role: values.role ? undefined : "Pick a role",
    terms: values.terms ? undefined : "Accept the terms",
  })
  const shown = (key: keyof ReturnType<typeof errors>) => (tried() ? errors()[key] : undefined)
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setTried(true)
        setSent(Object.values(errors()).every((error) => error === undefined))
      }}
    >
      <Stack gap="5" maxW="md">
        <TextField
          label="Name"
          required
          value={values.name}
          onValueChange={(name) => setValues("name", name)}
          errorText={shown("name")}
        />
        <TextField
          label="Email"
          type="email"
          required
          value={values.email}
          onValueChange={(email) => setValues("email", email)}
          errorText={shown("email")}
        />
        <SelectField
          label="Role"
          required
          placeholder="Choose one"
          items={["Admin", "Editor", "Viewer"]}
          value={values.role}
          onValueChange={(role) => setValues("role", role)}
          errorText={shown("role")}
        />
        <CheckboxField
          label="I accept the terms"
          checked={values.terms}
          onCheckedChange={(terms) => setValues("terms", terms)}
          errorText={shown("terms")}
        />
        <HStack>
          <Button type="submit">Create account</Button>
          {sent() ? <span data-testid="sent">Sent</span> : null}
        </HStack>
      </Stack>
    </form>
  )
}
