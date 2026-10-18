import { existsSync } from "node:fs"
import { join } from "node:path"
import { WEB_BUNDLE_FILE } from "./shared"

export interface AppDevOptions {
  /** Where `mosaikApp()` builds the browser bundle. Defaults to `dist/web`. */
  readonly webDir?: string
}

/** How often the bundle's manifest is checked for a rebuild. */
const POLL_MS = 500

/**
 * An app's development loop (`scripts/dev.ts`, `bun run dev`): generates its Panda runtime (if
 * it has a `panda.config.ts`), rebuilds the browser bundle on every change, and runs the backend
 * with `bun --watch`.
 *
 * The backend is also restarted whenever a rebuild changes the bundle: it reads the bundle's
 * file names (content-hashed) once at startup to register them with the platform, so without
 * a restart the shell would ask for files the rebuild just deleted.
 */
export const runAppDev = async (options: AppDevOptions = {}): Promise<void> => {
  const bundleFile = join(options.webDir ?? "dist/web", WEB_BUNDLE_FILE)
  const readBundle = () =>
    Bun.file(bundleFile)
      .text()
      .catch(() => "")
  const spawn = (cmd: ReadonlyArray<string>) => Bun.spawn([...cmd], { stdout: "inherit", stderr: "inherit" })

  if (existsSync("panda.config.ts")) {
    Bun.spawnSync(["bunx", "panda", "codegen", "--silent"], { stdout: "inherit", stderr: "inherit" })
  }
  // `--bun`: Vite loads the SDK's TypeScript sources with Bun (Node cannot).
  const web = spawn(["bun", "--bun", "vite", "build", "--watch", "--mode", "development"])
  const startServer = () => spawn(["bun", "--watch", "server/main.ts"])
  let server = startServer()

  let bundle = await readBundle()
  let restarting = false
  const poll = setInterval(async () => {
    if (restarting) return
    const next = await readBundle()
    if (next === "" || next === bundle) return
    bundle = next
    restarting = true
    server.kill()
    await server.exited
    server = startServer()
    restarting = false
  }, POLL_MS)

  const stop = () => {
    clearInterval(poll)
    web.kill()
    server.kill()
    process.exit(0)
  }
  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)
  // A crashing backend is restarted by `bun --watch` on the next change; a stopped build ends the loop.
  await web.exited
  stop()
}
