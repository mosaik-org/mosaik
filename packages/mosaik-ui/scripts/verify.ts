/**
 * `bun run verify` — installs the packed package (`bun run build` first) into the apps in
 * `verify/`, copied outside the repository so nothing resolves to the sources, and checks the
 * ways an app uses it:
 *
 * - `plain`: an app without Panda builds with the stylesheet and the components (the `solid`
 *   condition, compiled by the app's Vite);
 * - `plain/server.js`: the `node` build renders on the server;
 * - `panda`: an app with `designSystem: "@mosaik/mosaik-ui"` gets the library's recipes without
 *   scanning it, and its own styles with the library's tokens and prefix.
 */
import { cp, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { $ } from "bun"

const PACKAGE = join(import.meta.dirname, "..")
const DIST = join(PACKAGE, "dist")
const tarball = (await readdir(DIST).catch(() => [])).find((file) => file.endsWith(".tgz"))
if (!tarball) throw new Error("No package in dist/: run `bun run build` first")

const work = await mkdtemp(join(tmpdir(), "mosaik-ui-verify-"))
let failed = false
const check = (app: string, what: string, ok: boolean) => {
  console.log(`${ok ? "✓" : "✗"} ${app}: ${what}`)
  if (!ok) failed = true
}

const install = async (app: string) => {
  const dir = join(work, app)
  await cp(join(PACKAGE, "verify", app), dir, { recursive: true })
  const manifest = join(dir, "package.json")
  await Bun.write(manifest, (await Bun.file(manifest).text()).replace("TARBALL", `file:${join(DIST, tarball)}`))
  await $`bun install --silent`.cwd(dir).quiet()
  return dir
}

/** The CSS a Vite build wrote. */
const builtCss = async (dir: string) => {
  const assets = join(dir, "dist/assets")
  const files = (await readdir(assets)).filter((file) => file.endsWith(".css"))
  return (await Promise.all(files.map((file) => Bun.file(join(assets, file)).text()))).join("\n")
}

try {
  const plain = await install("plain")
  const build = await $`bun run build`.cwd(plain).quiet().nothrow()
  check("plain", "builds", build.exitCode === 0)
  if (build.exitCode === 0) {
    const css = await builtCss(plain)
    check("plain", "ships the recipes", css.includes(".mk-button") && css.includes(".mk-select__trigger"))
    check("plain", "ships the palettes", css.includes("--mk-colors-accent-solid-bg"))
  } else console.log(build.stderr.toString())

  const ssr = await $`bun server.js`.cwd(plain).quiet().nothrow()
  const html = ssr.stdout.toString()
  check("plain", "renders on the server", ssr.exitCode === 0 && html.includes("mk-button") && html.includes("Required"))
  if (ssr.exitCode !== 0) console.log(ssr.stderr.toString())

  const panda = await install("panda")
  const pandaBuild = await $`bun run build`.cwd(panda).quiet().nothrow()
  check("panda", "builds", pandaBuild.exitCode === 0)
  if (pandaBuild.exitCode === 0) {
    const css = await builtCss(panda)
    check("panda", "gets the library's recipes from its build info", css.includes(".mk-button"))
    check("panda", "styles its own code with the library's tokens", css.includes("mk-p_7") && css.includes("mk-mt_9"))
    check("panda", "keeps the library's prefix", !/\.p_7\b/.test(css))
  } else console.log(pandaBuild.stderr.toString(), pandaBuild.stdout.toString())
} finally {
  await rm(work, { recursive: true, force: true })
}

if (failed) process.exit(1)
