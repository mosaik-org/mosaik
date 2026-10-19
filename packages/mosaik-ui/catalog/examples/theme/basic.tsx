import { ThemeProvider, ThemeToggle } from "@mosaik/mosaik-ui"

/** Choosing a theme here changes the whole catalog, as it would an app. */
export const App = () => (
  <ThemeProvider>
    <ThemeToggle />
  </ThemeProvider>
)
