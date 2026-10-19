import { defineConfig } from "@pandacss/dev"
import library from "../panda.config"

/**
 * The catalog's stylesheet: the library's (every recipe, palette and token) plus the atomic styles
 * its examples use, which the library's own stylesheet leaves out. Codegen stays the library's.
 * Paths are relative to the package, where the catalog runs.
 */
export default defineConfig({
  ...library,
  include: ["./src/**/*.{ts,tsx}", "./catalog/**/*.{ts,tsx}"],
  exclude: ["./catalog/node_modules/**"],
})
