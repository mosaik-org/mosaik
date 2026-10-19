// An app that runs Panda: its own styles use the library's tokens, next to the library's components.
import "./index.css"
import { Button, TextField } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/mosaik-ui/css"
import { render } from "solid-js/web"

const App = () => (
  <main class={css({ p: "7", bg: "accent.subtle.bg", borderRadius: "l3" })}>
    <TextField label="Email" type="email" />
    <Button mt="9" colorPalette="danger">
      Delete
    </Button>
  </main>
)

const root = document.getElementById("root")
if (root) render(() => <App />, root)
