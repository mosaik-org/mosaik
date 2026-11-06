import { mosaikApp } from "@mosaik/sdk/build/vite"
import { defineConfig } from "vite"

/** Builds the browser bundle into dist/web; the backend serves it at /apps/desk/. */
export default defineConfig({ plugins: [mosaikApp()] })
