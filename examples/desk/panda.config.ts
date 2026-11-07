import { appPandaConfig } from "@mosaik/web-sdk/build/panda"
import { defineConfig } from "@pandacss/dev"

// Classes are prefixed with the app id, so they never collide with the shell's; values read the shell's `--mk-` variables.
export default defineConfig(appPandaConfig({ prefix: "desk", include: ["./web/**/*.{ts,tsx}"] }))
