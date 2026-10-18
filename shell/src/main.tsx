import "./index.css"
import { ThemeProvider, Toaster } from "@mosaik/ui"
import { QueryClientProvider } from "@tanstack/solid-query"
import { RouterProvider } from "@tanstack/solid-router"
import { render } from "solid-js/web"
import { registerInstalledApps } from "./installed"
import { createAppRouter, queryClient } from "./router"

const root = document.getElementById("app")
if (root === null) throw new Error("#app element missing")

// Installed apps add routes (placeholders until each is first opened), so they are registered before the router is created.
await registerInstalledApps()
const router = createAppRouter()

render(
  () => (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  ),
  root,
)
