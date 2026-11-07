/**
 * `bun examples:verify [id...]` — typechecks, tests and builds every example the way a team's app gets
 * the SDK: copied out of the repository, with `@mosaik/sdk`, `@mosaik/web-sdk` and `@mosaik/mosaik-ui` installed
 * from the packed tarballs instead of linked from the workspace. That catches what the workspace hides: a file missing
 * from the tarball, an import the SDK does not export, a dependency only the monorepo has.
 * A failed example's copy is kept for a look.
 */
import { cp, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { packSdk, SDK_DIR } from "./sdk-pack"
import { discoverExamples } from "./workspace"

/** Built or generated in place: the copy makes its own. */
const LOCAL = new Set(["node_modules", "dist", "styled-system", "mosaik-app.json"])

const run = (cmd: ReadonlyArray<string>, cwd: string) => {
  const result = Bun.spawnSync([...cmd], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, FORCE_COLOR: "0" },
  })
  return { ok: result.exitCode === 0, output: `${result.stdout.toString()}${result.stderr.toString()}`.trim() }
}

const only = new Set(process.argv.slice(2))
const examples = (await discoverExamples()).filter((example) => only.size === 0 || only.has(example.manifest.id))
const sdk = await packSdk()
const tarball = join(SDK_DIR, sdk.tarball)
const web = join(SDK_DIR, sdk.web.tarball)
const components = join(SDK_DIR, sdk.components.tarball)
console.log(`SDK ${sdk.version}: ${tarball}, ${web}, components ${sdk.components.version}\n`)

let failed = 0
for (const example of examples) {
  const id = example.manifest.id
  const dir = await mkdtemp(join(tmpdir(), `mosaik-verify-${id}-`))
  await cp(example.dir, dir, { recursive: true, filter: (path) => !LOCAL.has(path.split("/").at(-1) ?? "") })
  const manifestPath = join(dir, "package.json")
  const manifest = (await Bun.file(manifestPath).json()) as {
    dependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    if (name.startsWith("@mosaik/") && !["@mosaik/sdk", "@mosaik/web-sdk", "@mosaik/mosaik-ui"].includes(name)) {
      throw new Error(`${id} depends on ${name}`)
    }
  }
  manifest.dependencies = {
    ...manifest.dependencies,
    "@mosaik/sdk": `file:${tarball}`,
    // Only for those that use them: an app with its own UI must install without them.
    ...(manifest.dependencies?.["@mosaik/web-sdk"] === undefined ? {} : { "@mosaik/web-sdk": `file:${web}` }),
    ...(manifest.dependencies?.["@mosaik/mosaik-ui"] === undefined
      ? {}
      : { "@mosaik/mosaik-ui": `file:${components}` }),
  }
  await Bun.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  const steps: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
    ["install", ["bun", "install"]],
    ["typecheck", ["bunx", "tsc", "--noEmit"]],
    ["build", ["bun", "run", "build"]],
    // Its tests, with the testing kit as a team's app gets it.
    ...(manifest.scripts?.test === undefined ? [] : [["test", ["bun", "run", "test"]] as const]),
  ]
  let ok = true
  for (const [name, cmd] of steps) {
    const result = run(cmd, dir)
    if (!result.ok) {
      console.log(`✗ ${id}: ${name} failed (kept in ${dir})\n${result.output.split("\n").slice(-30).join("\n")}\n`)
      ok = false
      break
    }
  }
  if (ok) {
    console.log(
      `✓ ${id}: installs from the tarballs, typechecks${manifest.scripts?.test === undefined ? "" : ", passes its tests"} and builds`,
    )
    await rm(dir, { recursive: true, force: true })
  } else failed++
}

if (failed > 0) process.exit(1)
