import { mosaikApp } from "@mosaik/web-sdk/build/vite"
import { defineConfig } from "vite"

/** Builds the app's own page (index.html) into dist/web; the backend serves it at /. */
export default defineConfig({ plugins: [mosaikApp({ standalone: true })] })
