import { appPandaConfig } from "@mosaik/sdk/build/panda"
import { defineConfig } from "@pandacss/dev"

// Classes and variables are prefixed with the app id, so they never collide with the shell's.
export default defineConfig(appPandaConfig({ prefix: "sales", include: ["./web/**/*.{ts,tsx}"] }))
