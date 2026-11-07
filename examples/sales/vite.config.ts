import { mosaikApp } from "@mosaik/web-sdk/build/vite"
import { defineConfig } from "vite"

/** Builds the browser bundle into dist/web; the backend serves it at /apps/sales/. */
export default defineConfig({ plugins: [mosaikApp()] })
