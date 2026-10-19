// Server rendering through the package's `node` build, without a bundler.
import { Button, TextField } from "@mosaik/mosaik-ui"
import { createComponent, renderToString } from "solid-js/web"

const html = renderToString(() => [
  createComponent(Button, { children: "Save" }),
  createComponent(TextField, { label: "Email", errorText: "Required" }),
])
console.log(html)
