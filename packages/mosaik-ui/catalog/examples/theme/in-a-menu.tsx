import { ActionMenu, Button, ThemeChoice, ThemeProvider } from "@mosaik/mosaik-ui"

/** The theme as a row of an account menu: choosing one leaves the menu open. */
export const App = () => (
  <ThemeProvider>
    <ActionMenu
      trigger={(trigger) => (
        <Button variant="outline" {...trigger()}>
          Account
        </Button>
      )}
      header="Ada Lovelace"
      items={[{ value: "sign-out", label: "Sign out", onSelect: () => {} }]}
    >
      <ThemeChoice />
    </ActionMenu>
  </ThemeProvider>
)
