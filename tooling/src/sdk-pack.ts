/**
 * `bun sdk:pack` — packs the SDK into `dist/sdk/`, versioned like the platform, plus `sdk.json` naming
 * the tarballs. Apps built outside this repository install them from there (`bun create:app` copies
 * them in), until they are published to a registry. There are two, for two kinds of app:
 *
 * - `@mosaik/sdk`: what every app builds on, with none of Mosaik's UI, so a team can bring its own.
 *   Solid's packages are optional peers: only `/solid` and `/router` use them.
 * - `@mosaik/web-sdk`: Mosaik's UI (components, tables, charts, styles, the shell's frame and the page
 *   builds), on top of the first.
 *
 * Each is its facade (the entry points apps import) with the sources of the internal packages it
 * builds on under `internal/<name>/`, their `@mosaik/*` imports rewritten to relative paths, so
 * nothing the facades do not export is reachable by name. The internal packages both use ship once,
 * in `@mosaik/sdk`, which exports them under `internal/` for `@mosaik/web-sdk` alone: two copies in an
 * app would each keep their own state (the toaster, the session, the classes errors are matched by).
 * They ship TypeScript: Bun, Vite (`bun --bun`) and `tsc` read it as it is.
 *
 * The component library, `@mosaik/ui`, is not inside: apps import it themselves, so it is its own
 * tarball next to them (built in its own repository), a peer of `@mosaik/web-sdk` at that exact version.
 */
import { cp, mkdir, readdir, rm } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { PLATFORM_VERSION } from "@mosaik/platform/contract"
import { ROOT } from "./workspace"

export const SDK_DIR = join(ROOT, "dist", "sdk")
const STAGE = join(SDK_DIR, "stage")
const SDK = "@mosaik/sdk"
const WEB_SDK = "@mosaik/web-sdk"

export interface SdkIndex {
  readonly version: string
  /** `@mosaik/sdk`'s tarball, in the SDK directory. */
  readonly tarball: string
  /** `@mosaik/web-sdk`'s, next to it. */
  readonly web: { readonly tarball: string }
  /** The component library's tarball, next to them. */
  readonly components: { readonly version: string; readonly tarball: string }
}

/** The component library: a package of its own, which apps install next to the SDK. */
const COMPONENTS = "@mosaik/ui"

/**
 * What the library's build leaves (`bun run build` in its repository): the package the workspaces
 * install, and its tarball. The repository is checked out beside this one, as their `file:`
 * dependencies say.
 */
const LIBRARY_DIST = join(ROOT, "..", "mosaik-ui", "dist")

/** Solid's packages: optional for `@mosaik/sdk`, whose `/solid` and `/router` alone use them. */
const FRAMEWORK: ReadonlySet<string> = new Set(["solid-js", "@tanstack/solid-query", "@tanstack/solid-router"])

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
const isInternal = (name: string) => name.startsWith("@mosaik/") && name !== COMPONENTS

/** The internal packages a facade builds on, transitively, leaving out those another tarball ships. */
const closure = async (
  facade: string,
  elsewhere: ReadonlySet<string> = new Set(),
): Promise<ReadonlyMap<string, PackageJson>> => {
  const found = new Map<string, PackageJson>()
  const visit = async (name: string) => {
    if (found.has(name) || elsewhere.has(name)) return
    const manifest = await readPackage(dirOf(name))
    found.set(name, manifest)
    for (const dependency of Object.keys(manifest.dependencies ?? {}).filter(isInternal)) await visit(dependency)
  }
  await visit(facade)
  return found
}

/** Where a package lives in its facade's tarball. */
const placeOf = (facade: string, name: string) => (name === facade ? "" : `internal/${name.replace("@mosaik/", "")}`)

/** Every `@mosaik/<name>[/<entry>]` specifier of the packages → the file it means, from the tarball's root. */
const specifiers = (facade: string, packages: ReadonlyMap<string, PackageJson>) => {
  const targets = new Map<string, string>()
  for (const [name, manifest] of packages) {
    for (const [entry, target] of Object.entries(manifest.exports ?? {})) {
      const file = typeof target === "string" ? target : target.default
      if (file === undefined) continue
      targets.set(entry === "." ? name : `${name}/${entry.slice(2)}`, join(placeOf(facade, name), file))
    }
  }
  return targets
}

/** `@mosaik/<name>[/<entry>]` → `@mosaik/sdk/internal/<name>[/<entry>]`: how `@mosaik/web-sdk` reaches a shared one. */
const sharedSpecifier = (specifier: string) => `${SDK}/internal/${specifier.replace("@mosaik/", "")}`

/** Only import and export statements: Schema identifiers such as "@mosaik/core/Principal" stay. */
const IMPORT = /((?:\bfrom|\bimport)\s*\(?\s*)(["'])(@mosaik\/[^"']+)\2/g
/** A stylesheet's `@import` of another package's (`@mosaik/web-sdk/ui/styles.css` imports the kit's). */
const CSS_IMPORT = /(@import\s+)(["'])(@mosaik\/[^"']+)\2/g

/**
 * Rewrites internal specifiers: a package in the tarball to a relative, extensionless path (Bun, Vite
 * and `tsc` resolve those), one `@mosaik/sdk` ships to its `internal/` export.
 */
const rewrite = (source: string, file: string, targets: ReadonlyMap<string, string>, shared: ReadonlySet<string>) =>
  source.replace(
    file.endsWith(".css") ? CSS_IMPORT : IMPORT,
    (whole, prefix: string, quote: string, specifier: string) => {
      if (shared.has(specifier)) return `${prefix}${quote}${sharedSpecifier(specifier)}${quote}`
      const target = targets.get(specifier)
      if (target === undefined) return whole
      // Scripts without their extension (Bun, Vite and `tsc` resolve those); stylesheets with it.
      const path = relative(dirname(file), file.endsWith(".css") ? target : target.replace(/\.(ts|tsx|mjs|js)$/, ""))
        .split("\\")
        .join("/")
      return `${prefix}${quote}${path.startsWith(".") ? path : `./${path}`}${quote}`
    },
  )

const SKIPPED = new Set(["node_modules", "dist", "package.json", "tsconfig.json"])

/** Copies a package's shipped files (its `files`, or everything but tests and local config). */
const copyPackage = async (stage: string, facade: string, name: string, manifest: PackageJson) => {
  const from = dirOf(name)
  const to = join(stage, placeOf(facade, name))
  const entries = manifest.files ?? (await readdir(from)).filter((entry) => !SKIPPED.has(entry))
  for (const entry of entries) {
    await cp(join(from, entry), join(to, entry), {
      recursive: true,
      filter: (path) => !/\.test\.tsx?$/.test(path) && !path.includes("/node_modules"),
    })
  }
}

/** Third-party dependencies of every package in a tarball (one version each). */
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

const split = (all: Record<string, string>, take: (name: string) => boolean) => [
  Object.fromEntries(Object.entries(all).filter(([name]) => take(name))),
  Object.fromEntries(Object.entries(all).filter(([name]) => !take(name))),
]

const sourceFiles = async function* (dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* sourceFiles(path)
    else if (/\.(ts|tsx|mjs|js|css)$/.test(entry.name)) yield path
  }
}

interface Tarball {
  readonly facade: string
  readonly packages: ReadonlyMap<string, PackageJson>
  /** Specifiers of packages `@mosaik/sdk` ships, which this one imports from there. */
  readonly shared: ReadonlySet<string>
  /** What may stay imported by name: other packages the app installs. */
  readonly external: (specifier: string) => boolean
  readonly manifest: (facade: PackageJson) => Record<string, unknown>
}

/** Stages one facade with its packages, rewrites their imports, and packs it; returns the tarball's name. */
const pack = async (tarball: Tarball): Promise<string> => {
  const stage = join(STAGE, tarball.facade.replace("@mosaik/", ""))
  await mkdir(stage, { recursive: true })
  for (const [name, manifest] of tarball.packages) await copyPackage(stage, tarball.facade, name, manifest)
  const targets = specifiers(tarball.facade, tarball.packages)
  for await (const file of sourceFiles(stage)) {
    const source = await Bun.file(file).text()
    const rewritten = rewrite(source, relative(stage, file), targets, tarball.shared)
    if (rewritten !== source) await Bun.write(file, rewritten)
  }
  // Anything internal left by name would not resolve in an app: fail here, not there.
  for await (const file of sourceFiles(stage)) {
    for (const match of (await Bun.file(file).text()).matchAll(file.endsWith(".css") ? CSS_IMPORT : IMPORT)) {
      const specifier = match[3] ?? ""
      if (!tarball.external(specifier)) {
        throw new Error(`${tarball.facade}: ${relative(stage, file)} imports ${specifier}, which it does not ship`)
      }
    }
  }
  const facade = tarball.packages.get(tarball.facade)
  if (facade === undefined) throw new Error(`${tarball.facade} not found`)
  await Bun.write(join(stage, "LICENSE"), Bun.file(join(ROOT, "LICENSE")))
  await Bun.write(join(stage, "package.json"), `${JSON.stringify(tarball.manifest(facade), null, 2)}\n`)
  const packed = Bun.spawnSync(["bun", "pm", "pack", "--destination", SDK_DIR, "--quiet", "--ignore-scripts"], {
    cwd: stage,
    stderr: "pipe",
  })
  if (packed.exitCode !== 0) throw new Error(`Packing ${tarball.facade} failed:\n${packed.stderr.toString()}`)
  const name = `${tarball.facade.replace("@", "").replace("/", "-")}-${PLATFORM_VERSION}.tgz`
  if (!(await Bun.file(join(SDK_DIR, name)).exists())) throw new Error(`Expected ${name} in ${SDK_DIR}`)
  return name
}

export const packSdk = async (): Promise<SdkIndex> => {
  // Generated, so possibly older than the sources: the Panda runtimes `@mosaik/web-sdk` ships, and the
  // kit's stylesheet (`@mosaik/web-sdk/ui/styles.css`), are generated afresh.
  // The component library is built (and packed) in its own repository.
  for (const [dir, command] of [["packages/styled-system", ["bun", "run", "prepare"]]] as const) {
    const run = Bun.spawnSync([...command], { cwd: join(ROOT, dir), stderr: "pipe" })
    if (run.exitCode !== 0) throw new Error(`Building ${dir} failed:\n${run.stderr.toString()}`)
  }
  const library = await readPackage(join(LIBRARY_DIST, "package"))
  const libraryTarball = `mosaik-ui-${library.version}.tgz`
  if (!(await Bun.file(join(LIBRARY_DIST, libraryTarball)).exists())) {
    throw new Error(`${libraryTarball} not found in ${LIBRARY_DIST}: run \`bun run build\` in mosaik-ui`)
  }
  const core = await closure(SDK)
  const web = await closure(WEB_SDK, new Set(core.keys()))
  for (const manifest of [...core.values(), ...web.values()]) {
    if (manifest.version !== PLATFORM_VERSION) {
      throw new Error(
        `${manifest.name} is ${manifest.version}; the SDK is versioned like the platform (${PLATFORM_VERSION})`,
      )
    }
  }

  await rm(SDK_DIR, { recursive: true, force: true })
  await mkdir(STAGE, { recursive: true })
  await cp(join(LIBRARY_DIST, libraryTarball), join(SDK_DIR, libraryTarball))

  // What `@mosaik/web-sdk` imports of the packages `@mosaik/sdk` ships, which the latter exports for it.
  const coreTargets = specifiers(SDK, core)
  const shared = new Set(
    [...coreTargets.keys()].filter((specifier) => specifier !== SDK && !specifier.startsWith(`${SDK}/`)),
  )
  const internalExports = Object.fromEntries(
    [...shared].map((specifier) => [
      `./${sharedSpecifier(specifier).slice(SDK.length + 1)}`,
      `./${coreTargets.get(specifier)}`,
    ]),
  )

  const [coreFramework, coreDependencies] = split(thirdParty(core, "dependencies"), (name) => FRAMEWORK.has(name))
  const sdkTarball = await pack({
    facade: SDK,
    packages: core,
    shared: new Set(),
    external: () => false,
    manifest: (facade) => ({
      name: SDK,
      version: PLATFORM_VERSION,
      type: "module",
      description: "The Mosaik SDK: what every app builds on, with none of Mosaik's UI.",
      license: "MIT",
      // `internal/` is for `@mosaik/web-sdk`, so that both use one copy of what they share; not for apps.
      exports: { ...facade.exports, ...internalExports },
      dependencies: coreDependencies,
      peerDependencies: { ...thirdParty(core, "peerDependencies"), ...coreFramework },
      peerDependenciesMeta: Object.fromEntries(
        Object.keys(coreFramework ?? {}).map((name) => [name, { optional: true }]),
      ),
    }),
  })
  const webTarball = await pack({
    facade: WEB_SDK,
    packages: web,
    shared,
    external: (specifier) =>
      specifier === COMPONENTS ||
      specifier.startsWith(`${COMPONENTS}/`) ||
      Object.hasOwn(internalExports, `./${specifier.slice(SDK.length + 1)}`),
    manifest: (facade) => ({
      name: WEB_SDK,
      version: PLATFORM_VERSION,
      type: "module",
      description: "Mosaik's UI for apps: components, tables, charts, styles, and the shell's frame.",
      license: "MIT",
      exports: facade.exports,
      dependencies: Object.fromEntries(
        Object.entries(thirdParty(web, "dependencies")).filter(([name]) => name !== COMPONENTS),
      ),
      // Both at the exact versions it was built with.
      peerDependencies: {
        ...thirdParty(web, "peerDependencies"),
        [SDK]: PLATFORM_VERSION,
        [COMPONENTS]: library.version,
      },
      // Installed by the app itself (from their tarballs until they are on a registry): the package
      // manager must not look for them.
      peerDependenciesMeta: { [SDK]: { optional: true }, [COMPONENTS]: { optional: true } },
    }),
  })
  await rm(STAGE, { recursive: true, force: true })

  const index: SdkIndex = {
    version: PLATFORM_VERSION,
    tarball: sdkTarball,
    web: { tarball: webTarball },
    components: { version: library.version, tarball: libraryTarball },
  }
  await Bun.write(join(SDK_DIR, "sdk.json"), `${JSON.stringify(index, null, 2)}\n`)
  return index
}

if (import.meta.main) {
  const index = await packSdk()
  console.log(
    `Packed SDK ${index.version} into dist/sdk/: ${index.tarball} and ${index.web.tarball}, next to ${index.components.tarball}`,
  )
}
