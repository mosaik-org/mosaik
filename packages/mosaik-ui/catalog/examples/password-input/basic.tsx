import { PasswordInput } from "@mosaik/mosaik-ui"

export const App = () => (
  <PasswordInput.Root maxW="sm">
    <PasswordInput.Label>Password</PasswordInput.Label>
    <PasswordInput.Control>
      <PasswordInput.Input placeholder="Enter your password" />
      <PasswordInput.VisibilityTrigger>
        <PasswordInput.Indicator />
      </PasswordInput.VisibilityTrigger>
    </PasswordInput.Control>
  </PasswordInput.Root>
)
