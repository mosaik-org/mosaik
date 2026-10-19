import { fileURLToPath } from "node:url"

const pkg = fileURLToPath(new URL("..", import.meta.url))

export default {
  plugins: {
    "@pandacss/dev/postcss": { configPath: fileURLToPath(new URL("panda.config.ts", import.meta.url)), cwd: pkg },
  },
}
