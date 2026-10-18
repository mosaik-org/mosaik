/**
 * `bun sdk:pack` — packs the SDK into one tarball, `dist/sdk/mosaik-sdk-<version>.tgz`, versioned like
 * the platform, plus `sdk.json` naming it. Apps built outside this repository install it from there
 * (`bun create:app` copies it in), until it is published to a registry.
 *
 * The tarball is `@mosaik/sdk` (the facade apps import) with the sources of the internal packages it
 * builds on under `internal/<name>/`, their `@mosaik/*` imports rewritten to relative paths. Apps get
 * one package and one version, and nothing the facade does not export is reachable by name. It ships
 * TypeScript: Bun, Vite (`bun --bun`) and `tsc` read it as it is.
 */
import { cp, mkdir, readdir, rm } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { PLATFORM_VERSION } from "@mosaik/platform/contract"
import { ROOT } from "./workspace"

export const SDK_DIR = join(ROOT, "dist", "sdk")
const STAGE = join(SDK_DIR, "stage")
const FACADE = "@mosaik/sdk"

export interface SdkIndex {
  readonly version: string
  /** The tarball's file name in the SDK directory. */
  readonly tarball: string
}

type Exports = Record<string, string | { readonly types?: string; readonly default?: string }>

interface PackageJson {
  readonly name: string
  readonly version: string
  readonly exports?: Exports
  readonly files?: ReadonlyArray<string>
  readonly dependencies?: Record<string, string>
  readonly peerDependencies?: Record<string, string>
}

const readPackage = (dir: string) => Bun.file(join(dir, "package.json")).json() as Promise<PackageJson>
const dirOf = (name: string) => join(ROOT, "packages", name.replace("@mosaik/", ""))
const isInternal = (name: string) => name.startsWith("@mosaik/")

/** The internal packages the facade builds on, transitively. */
const closure = async (): Promise<ReadonlyMap<string, PackageJson>> => {
  const found = new Map<string, PackageJson>()
  const visit = async (name: string) => {
    if (found.has(name)) return
    const manifest = await readPackage(dirOf(name))
    found.set(name, manifest)
    for (const dependency of Object.keys(manifest.dependencies ?? {}).filter(isInternal)) await visit(dependency)
  }
  await visit(FACADE)
  return found
}

/** Where a package lives in the tarball. */
const placeOf = (name: string) => (name === FACADE ? "" : `internal/${name.replace("@mosaik/", "")}`)

/** Every `@mosaik/<name>[/<entry>]` specifier → the file it means, relative to the tarball's root. */
const specifiers = (packages: ReadonlyMap<string, PackageJson>) => {
  const targets = new Map<string, string>()
  for (const [name, manifest] of packages) {
    for (const [entry, target] of Object.entries(manifest.exports ?? {})) {
      const file = typeof target === "string" ? target : target.default
      if (file === undefined) continue
      targets.set(entry === "." ? name : `${name}/${entry.slice(2)}`, join(placeOf(name), file))
    }
  }
  return targets
}

/** Only import and export statements: Schema identifiers such as "@mosaik/core/Principal" stay. */
const IMPORT = /((?:\bfrom|\bimport)\s*\(?\s*)(["'])(@mosaik\/[^"']+)\2/g

/** Rewrites internal specifiers to relative, extensionless paths (Bun, Vite and `tsc` resolve those). */
const rewrite = (source: string, file: string, targets: ReadonlyMap<string, string>) =>
  source.replace(IMPORT, (whole, prefix: string, quote: string, specifier: string) => {
    const target = targets.get(specifier)
    if (target === undefined) return whole
    const path = relative(dirname(file), target.replace(/\.(ts|tsx|mjs|js)$/, ""))
      .split("\\")
      .join("/")
    return `${prefix}${quote}${path.startsWith(".") ? path : `./${path}`}${quote}`
  })

const SKIPPED = new Set(["node_modules", "dist", "package.json", "tsconfig.json"])

/** Copies a package's shipped files (its `files`, or everything but tests and local config). */
const copyPackage = async (name: string, manifest: PackageJson) => {
  const from = dirOf(name)
  const to = join(STAGE, placeOf(name))
  const entries = manifest.files ?? (await readdir(from)).filter((entry) => !SKIPPED.has(entry))
  for (const entry of entries) {
    await cp(join(from, entry), join(to, entry), {
      recursive: true,
      filter: (path) => !/\.test\.tsx?$/.test(path) && !path.includes("/node_modules"),
    })
  }
}

/** Third-party dependencies of every package in the tarball (one version each). */
const thirdParty = (packages: ReadonlyMap<string, PackageJson>, field: "dependencies" | "peerDependencies") => {
  const merged: Record<string, string> = {}
  for (const manifest of packages.values()) {
    for (const [dependency, version] of Object.entries(manifest[field] ?? {})) {
      if (isInternal(dependency)) continue
      const known = merged[dependency]
      if (known !== undefined && known !== version) {
        throw new Error(`${dependency}: ${known} and ${version} in the SDK's packages; use one version`)
      }
      merged[dependency] = version
    }
  }
  return Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)))
}

const sourceFiles = async function* (dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* sourceFiles(path)
    else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) yield path
  }
}

export const packSdk = async (): Promise<SdkIndex> => {
  if (!(await Bun.file(join(ROOT, "packages/styled-system/generated/css/index.mjs")).exists())) {
    throw new Error("Run `panda codegen` in packages/styled-system first (bun install does it)")
  }
  const packages = await closure()
  for (const manifest of packages.values()) {
    if (manifest.version !== PLATFORM_VERSION) {
      throw new Error(
        `${manifest.name} is ${manifest.version}; the SDK is versioned like the platform (${PLATFORM_VERSION})`,
      )
    }
  }

  await rm(SDK_DIR, { recursive: true, force: true })
  await mkdir(STAGE, { recursive: true })
  for (const [name, manifest] of packages) await copyPackage(name, manifest)

  const targets = specifiers(packages)
  for await (const file of sourceFiles(STAGE)) {
    const source = await Bun.file(file).text()
    const rewritten = rewrite(source, relative(STAGE, file), targets)
    if (rewritten !== source) await Bun.write(file, rewritten)
  }
  // Anything internal left by name would not resolve in an app: fail here, not there.
  for await (const file of sourceFiles(STAGE)) {
    for (const match of (await Bun.file(file).text()).matchAll(IMPORT)) {
      throw new Error(`${relative(STAGE, file)} imports ${match[3]}, which is not in the SDK`)
    }
  }

  const facade = packages.get(FACADE)
  if (facade === undefined) throw new Error(`${FACADE} not found`)
  await Bun.write(
    join(STAGE, "package.json"),
    `${JSON.stringify(
      {
        name: FACADE,
        version: PLATFORM_VERSION,
        type: "module",
        description: "The Mosaik SDK: everything an app builds on.",
        exports: facade.exports,
        dependencies: thirdParty(packages, "dependencies"),
        peerDependencies: thirdParty(packages, "peerDependencies"),
      },
      null,
      2,
    )}\n`,
  )

  const pack = Bun.spawnSync(["bun", "pm", "pack", "--destination", SDK_DIR, "--quiet", "--ignore-scripts"], {
    cwd: STAGE,
    stderr: "pipe",
  })
  if (pack.exitCode !== 0) throw new Error(`Packing ${FACADE} failed:\n${pack.stderr.toString()}`)
  const tarball = `mosaik-sdk-${PLATFORM_VERSION}.tgz`
  if (!(await Bun.file(join(SDK_DIR, tarball)).exists())) throw new Error(`Expected ${tarball} in ${SDK_DIR}`)
  await rm(STAGE, { recursive: true, force: true })

  const index: SdkIndex = { version: PLATFORM_VERSION, tarball }
  await Bun.write(join(SDK_DIR, "sdk.json"), `${JSON.stringify(index, null, 2)}\n`)
  return index
}

if (import.meta.main) {
  const index = await packSdk()
  console.log(`Packed SDK ${index.version} into dist/sdk/${index.tarball}`)
}
