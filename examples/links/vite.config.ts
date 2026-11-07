import { defineConfig } from "vite"

/** A plain Vite build of `index.html`: any tool will do, as long as the page ends up in dist/web. */
export default defineConfig({ build: { outDir: "dist/web", emptyOutDir: true, target: "es2023" } })
