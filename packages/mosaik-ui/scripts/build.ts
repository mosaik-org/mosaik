/**
 * `bun run build` — the package as it is published, in `dist/package/`, and packed into
 * `dist/mosaik-mosaik-ui-<version>.tgz`.
 *
 * In this repository the package's `exports` point at its sources, which the workspace compiles.
 * Published, they point at builds for each kind of consumer:
 *
 * - `solid`: the sources with their JSX kept (`.jsx`). Vite and SolidStart apps resolve this
 *   condition and compile it with their own settings (DOM or server, hydratable or not).
 * - `node` / `browser` / `default`: compiled for the server and the DOM, for other bundlers.
 * - `types`: declarations.
 * - `./styles.css`: every recipe, palette and token, for apps that do not run Panda; `./css/*` the
 *   same split by layer and recipe.
 * - `./panda/*` and `./css`, `./jsx`, ...: what `panda lib` writes, for apps that run Panda with
 *   `designSystem: "@mosaik/mosaik-ui"`.
 */
import { cp, mkdir, readdir, rm } from "node:fs/promises"
import { join, relative } from "node:path"
import { $ } from "bun"
import { build } from "vite"
import solid from "vite-plugin-solid"

const PACKAGE = join(import.meta.dirname, "..")
const DIST = join(PACKAGE, "dist")
const STAGE = join(DIST, "package")
const OUT = join(STAGE, "dist")
const panda = join(PACKAGE, "node_modules/.bin/panda")

const manifest = await Bun.file(join(PACKAGE, "package.json")).json()

await rm(DIST, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })
$.cwd(PACKAGE)

// The typed runtime the components import (`styled-system/`), and the stylesheets.
await $`${panda} codegen --silent`
await $`${panda} cssgen --silent --outfile ${join(OUT, "styles.css")}`
await $`${panda} cssgen --silent --splitting --outdir ${join(OUT, "css")}`

// Sources with JSX kept, and declarations; the theme in its own pass (see tsconfig.theme.json).
for (const config of ["tsconfig.build.json", "tsconfig.theme.json"]) {
  await $`bunx tsc -p ${config} --outDir ${join(OUT, "source")} --declarationDir ${join(OUT, "types")}`
}
await cp(join(PACKAGE, "styled-system"), join(OUT, "source/styled-system"), { recursive: true })
await cp(join(PACKAGE, "styled-system"), join(OUT, "types/styled-system"), {
  recursive: true,
  filter: (path) => !path.endsWith(".js"),
})

// Compiled for the DOM and for the server, module by module so apps tree-shake them.
const external = (id: string) => !id.startsWith(".") && !id.startsWith("/") && !id.startsWith("\0")
for (const target of ["dom", "server"] as const) {
  await build({
    configFile: false,
    logLevel: "warn",
    root: PACKAGE,
    plugins: [
      solid({ ssr: target === "server", solid: { generate: target === "server" ? "ssr" : "dom", hydratable: true } }),
    ],
    build: {
      outDir: join(OUT, target),
      emptyOutDir: true,
      minify: false,
      target: "es2022",
      ssr: target === "server" ? join(PACKAGE, "src/index.ts") : undefined,
      lib: { entry: join(PACKAGE, "src/index.ts"), formats: ["es"] },
      rollupOptions: {
        external,
        // Panda's generated runtime places `@__PURE__` where Rolldown ignores it; harmless.
        checks: { invalidAnnotation: false },
        output: { preserveModules: true, preserveModulesRoot: PACKAGE, entryFileNames: "[name].js" },
      },
    },
  })
}

// Panda's artifacts for apps that run Panda. `panda lib` also adds the exports Panda apps import
// (`./css`, `./helpers`, ...) to `package.json`: they are kept for the published one, and the
// repository's is put back.
const original = await Bun.file(join(PACKAGE, "package.json")).text()
let pandaExports: Record<string, unknown>
try {
  await $`${panda} lib --silent --outdir ${OUT} --panda ${manifest.devDependencies["@pandacss/dev"]} --files ${"../source/**/*.{js,jsx}"}`
  const { exports } = await Bun.file(join(PACKAGE, "package.json")).json()
  pandaExports = Object.fromEntries(
    Object.entries(exports as Record<string, unknown>)
      .filter(([path]) => !(path in manifest.exports))
      .map(([path, target]) => [path, path === "./panda/*" ? "./dist/panda/*" : target]),
  )
} finally {
  await Bun.write(join(PACKAGE, "package.json"), original)
}
await cp(join(PACKAGE, "styled-system"), join(STAGE, "styled-system"), { recursive: true })

await Bun.write(
  join(STAGE, "package.json"),
  `${JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      license: manifest.license,
      type: "module",
      sideEffects: ["**/*.css"],
      exports: {
        ".": {
          types: "./dist/types/src/index.d.ts",
          solid: "./dist/source/src/index.jsx",
          node: "./dist/server/src/index.js",
          browser: "./dist/dom/src/index.js",
          default: "./dist/dom/src/index.js",
        },
        "./preset": { types: "./dist/types/src/theme/index.d.ts", default: "./dist/source/src/theme/index.js" },
        "./styles.css": "./dist/styles.css",
        "./styles/*": "./dist/css/styles/*",
        "./package.json": "./package.json",
        ...pandaExports,
      },
      files: ["dist", "styled-system", "README.md", "LICENSE"],
      dependencies: manifest.dependencies,
      peerDependencies: {
        ...manifest.peerDependencies,
        "@pandacss/dev": manifest.devDependencies["@pandacss/dev"],
        "@pandacss/preset-base": manifest.devDependencies["@pandacss/preset-base"],
        "@pandacss/preset-panda": manifest.devDependencies["@pandacss/preset-panda"],
        "@pandacss/types": manifest.devDependencies["@pandacss/types"],
      },
      // Panda only for apps that build with it (`designSystem`) or import `./preset`.
      peerDependenciesMeta: {
        "@pandacss/dev": { optional: true },
        "@pandacss/preset-base": { optional: true },
        "@pandacss/preset-panda": { optional: true },
        "@pandacss/types": { optional: true },
      },
    },
    null,
    2,
  )}\n`,
)
for (const file of ["README.md", "LICENSE"]) await cp(join(PACKAGE, file), join(STAGE, file))

await $`bun pm pack --quiet --destination ${DIST}`.cwd(STAGE)
const tarball = (await readdir(DIST)).find((file) => file.endsWith(".tgz"))
console.log(`${manifest.name}: ${relative(process.cwd(), join(DIST, tarball ?? "?"))}`)
