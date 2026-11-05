import { PasswordField, TextareaField, TextField } from "@mosaik/mosaik-ui"
import MailIcon from "lucide-solid/icons/mail"
import { createSignal } from "solid-js"
import { Stack } from "styled-system/jsx"

export const App = () => {
  const [email, setEmail] = createSignal("")
  return (
    <Stack gap="5" maxW="md">
      <TextField
        label="Email"
        type="email"
        placeholder="name@company.com"
        helperText="We never share it."
        startElement={<MailIcon />}
        value={email()}
        onValueChange={setEmail}
      />
      <TextField label="Company" optionalText=" (optional)" />
      <TextField label="Username" required errorText="This username is taken" value="admin" />
      <PasswordField label="Password" autocomplete="new-password" helperText="At least 8 characters" />
      <TextareaField label="Notes" autoresize placeholder="Grows as you type" />
      <TextField label="Read-only" readOnly value="Can be selected, not changed" />
      <TextField label="Disabled" disabled value="Not available" />
    </Stack>
  )
}
