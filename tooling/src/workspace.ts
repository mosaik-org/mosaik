import { readdir } from "node:fs/promises"
import { join, relative, resolve } from "node:path"
import { type AnyApp, isApp } from "@mosaik/core"

export const ROOT = resolve(import.meta.dir, "../..")
/** The platform's own apps, shipped with it. */
export const APPS_DIR = join(ROOT, "apps")
/** Example apps, written like a team's installed app; `bun dev` runs them, production does not. */
export const EXAMPLES_DIR = join(ROOT, "examples")

export interface AppPackage {
  readonly manifest: AnyApp
  readonly dir: string
  /** `server/main.ts`, when the app has its own backend. */
  readonly entrypoint: string | null
  /** It serves its own page (`index.html`) on its own address, instead of being mounted in the shell. */
  readonly standalone: boolean
}

/** Discovers the apps in `<dir>/<id>/manifest.ts`. */
const discover = async (root: string): Promise<ReadonlyArray<AppPackage>> => {
  const folder = relative(ROOT, root)
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const apps: Array<AppPackage> = []
  for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const dir = join(root, entry.name)
    const manifestFile = Bun.file(join(dir, "manifest.ts"))
    if (!(await manifestFile.exists())) continue
    const module = await import(join(dir, "manifest.ts"))
    if (!isApp(module.default)) {
      throw new Error(`${folder}/${entry.name}/manifest.ts must default-export defineApp(...)`)
    }
    if (module.default.id !== entry.name) {
      throw new Error(`${folder}/${entry.name}: directory name must match the app id "${module.default.id}"`)
    }
    const entrypoint = join(dir, "server", "main.ts")
    const hasServer = module.default.backend && (await Bun.file(entrypoint).exists())
    const standalone = await Bun.file(join(dir, "index.html")).exists()
    apps.push({ manifest: module.default, dir, entrypoint: hasServer ? entrypoint : null, standalone })
  }
  return apps
}

/** Built-in apps (`apps/<id>`). */
export const discoverApps = () => discover(APPS_DIR)

/** Example apps (`examples/<id>`). */
export const discoverExamples = () => discover(EXAMPLES_DIR)
