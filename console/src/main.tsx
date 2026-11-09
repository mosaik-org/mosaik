import "./index.css"
import { ThemeProvider, Toasts } from "@mosaik/web-kit"
import { QueryClientProvider } from "@tanstack/solid-query"
import { RouterProvider } from "@tanstack/solid-router"
import { render } from "solid-js/web"
import { queryClient, router } from "./router"

const root = document.getElementById("app")
if (root === null) throw new Error("#app element missing")

render(
  () => (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toasts />
      </QueryClientProvider>
    </ThemeProvider>
  ),
  root,
)
