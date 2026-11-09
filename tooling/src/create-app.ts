/**
 * Creates an app:
 *
 *   bun create:app <id> [--dir ../<id>] [--name "Name"] [--description "..."] [--icon box] [--db]
 *   bun create:app <id> --builtin [--name ...] [--description ...] [--icon ...] [--db] [--public]
 *   bun create:app <id> --dir <path> --sdk-only     refresh vendor/mosaik/ in an existing app
 *
 * By default an app in its own repository, on the SDK tarball (`vendor/mosaik/`): it runs hosted
 * elsewhere or as a Docker image the Portal runs (see its README). `--builtin` creates it
 * in this repository instead (`apps/<id>`), shipped with the platform.
 *
 * --db       a Postgres database of its own (with a first migration)
 * --public   built-in apps: the anonymous role gets `view` on first registration
 */
import { copyFile, mkdir, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { AppIdPattern, isReservedId } from "@mosaik/core"
import { createBuiltinApp } from "./create-builtin-app"
import { packSdk, SDK_DIR, type SdkIndex } from "./sdk-pack"
import { appFiles } from "./templates/app"
import { ROOT } from "./workspace"

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    dir: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    icon: { type: "string", default: "box" },
    db: { type: "boolean", default: false },
    builtin: { type: "boolean", default: false },
    public: { type: "boolean", default: false },
    "sdk-only": { type: "boolean", default: false },
  },
})

const [id] = positionals
if (id === undefined || !AppIdPattern.test(id) || isReservedId(id)) {
  console.error(
    "Usage: bun create:app <id> [--dir path | --builtin [--public]] [--name ...] [--description ...] [--icon ...] [--db] [--sdk-only]",
  )
  console.error("The id must be lowercase letters, digits and dashes, starting with a letter, and not reserved.")
  process.exit(1)
}

const titleCase = (id: string) =>
  id.replace(/(^|-)(\w)/g, (_, dash: string, letter: string) => `${dash ? " " : ""}${letter.toUpperCase()}`)

if (values.builtin) {
  const name = values.name ?? titleCase(id)
  await createBuiltinApp({
    id,
    name,
    description: values.description ?? `${name}, a Mosaik app.`,
    icon: values.icon ?? "box",
    database: values.db ?? false,
    public: values.public ?? false,
  })
  process.exit(0)
}

const dir = resolve(values.dir ?? join(ROOT, "..", id))
const VENDOR = "vendor/mosaik"

/** Versions of third-party dependencies, taken from the platform so apps match it. */
const versions = async () => {
  const read = async (path: string) =>
    (await Bun.file(join(ROOT, path)).json()) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
  const shell = await read("shell/package.json")
  const root = await read("package.json")
  const all = { ...shell.dependencies, ...shell.devDependencies, ...root.devDependencies }
  const pick = (name: string) => {
    const version = all[name]
    if (version === undefined) throw new Error(`No version of ${name} in the platform`)
    return version
  }
  return { pick }
}

/** Copies the SDK's two tarballs and the components' into the app; returns the dependencies on them. */
const vendor = async (sdk: SdkIndex) => {
  await rm(join(dir, VENDOR), { recursive: true, force: true })
  await mkdir(join(dir, VENDOR), { recursive: true })
  for (const tarball of [sdk.tarball, sdk.web.tarball, sdk.components.tarball]) {
    await copyFile(join(SDK_DIR, tarball), join(dir, VENDOR, tarball))
  }
  return {
    "@mosaik/sdk": `file:./${VENDOR}/${sdk.tarball}`,
    "@mosaik/web-sdk": `file:./${VENDOR}/${sdk.web.tarball}`,
    "@mosaik/ui": `file:./${VENDOR}/${sdk.components.tarball}`,
  }
}

const sdk = await packSdk()
const mosaik = await vendor(sdk)

if (values["sdk-only"]) {
  const path = join(dir, "package.json")
  const manifest = (await Bun.file(path).json()) as Record<string, Record<string, string> | undefined>
  // The SDK's packages only: drop the per-package tarballs of earlier SDKs.
  for (const section of ["dependencies", "devDependencies", "overrides"]) {
    const entries = manifest[section]
    if (entries === undefined) continue
    for (const name of Object.keys(entries)) if (name.startsWith("@mosaik/")) delete entries[name]
    if (Object.keys(entries).length === 0) delete manifest[section]
  }
  manifest.dependencies = { ...manifest.dependencies, ...mosaik }
  await Bun.write(path, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Updated the SDK in ${dir} to ${sdk.version}. Then:

  bun install       # if the SDK version did not change, delete bun.lock and node_modules/@mosaik first:
                    # the lockfile pins the previous tarball's checksum
  bun run build     # and ship a new version of the app`)
  process.exit(0)
}

if (await Bun.file(join(dir, "package.json")).exists()) {
  console.error(`${dir} already contains an app (use --sdk-only to update its SDK)`)
  process.exit(1)
}

const { pick } = await versions()
const name = values.name ?? titleCase(id)
const files = appFiles({
  id,
  name,
  description: values.description ?? `${name}, a Mosaik app.`,
  icon: values.icon ?? "box",
  database: values.db ?? false,
  platformVersion: sdk.version,
  dependencies: {
    ...mosaik,
    "@tanstack/solid-query": pick("@tanstack/solid-query"),
    "@tanstack/solid-router": pick("@tanstack/solid-router"),
    effect: pick("effect"),
    "solid-js": pick("solid-js"),
  },
  devDependencies: {
    "@effect/vitest": pick("@effect/vitest"),
    "@pandacss/dev": pick("@pandacss/dev"),
    "@types/bun": pick("@types/bun"),
    postcss: pick("postcss"),
    typescript: pick("typescript"),
    vite: pick("vite"),
    vitest: pick("vitest"),
  },
})

for (const [path, content] of Object.entries(files)) {
  const target = join(dir, path)
  await mkdir(dirname(target), { recursive: true })
  await Bun.write(target, content)
}

console.log(`
Created ${name} (${id}) in ${dir} on SDK ${sdk.version}${values.db ? ", with a database" : ""}.

  cd ${dir}
  bun install
  bun run build && bun run typecheck

Then see its README: develop it hosted elsewhere, ship it as an image.
`)
