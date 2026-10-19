// An app without Panda: the library's stylesheet and its components.
import "@mosaik/mosaik-ui/styles.css"
import { Button, Dialog, SelectField, TextField } from "@mosaik/mosaik-ui"
import { render } from "solid-js/web"

const App = () => (
  <main>
    <TextField label="Email" type="email" />
    <SelectField label="Status" items={["Open", "Closed"]} />
    <Dialog.Root>
      <Dialog.Trigger asChild={(props) => <Button {...props()}>Open</Button>} />
    </Dialog.Root>
  </main>
)

const root = document.getElementById("root")
if (root) render(() => <App />, root)
