/**
 * Enforces architectural boundaries between workspaces (run by `bun lint`):
 *
 * 1. Apps are independent: no imports from other apps.
 * 2. Browser code (app `web/`, UI packages, the shell) never imports server-only modules.
 * 3. Shared contracts (`manifest.ts`, `api/`) stay isomorphic: no server-only or UI imports.
 * 4. App servers never import browser code.
 * 5. Shared packages never depend on apps (built-in or examples).
 * 6. Examples see only the SDK (`@mosaik/sdk`, `@mosaik/web-sdk` and their entry points), the component
 *    library (`@mosaik/mosaik-ui`) and their own files, like a team's app in its own repository; rules
 *    2–4 hold for the SDK's entry points too.
 * 7. Core (its services and the shared packages) never depends on the Portal. The SDK spans both
 *    layers for apps, through two modules only (`@mosaik/web-sdk/portal` and the build plugin): so an
 *    app that imports neither of the Portal's entry points needs nothing of the Portal.
 * 8. The Portal (its service, its package, the shell, built-in apps) uses Core only through its
 *    contracts and the SDK, never the code of Core's services.
 * 9. The testing kit (`@mosaik/sdk/testing`) is for tests (`*.test.ts`), never the code that ships.
 * 10. `@mosaik/mosaik-ui` stands alone: it imports nothing of Mosaik and nothing outside its
 *    directory, so it can move to a repository of its own.
 * 11. `@mosaik/sdk`, what every app builds on, imports none of Mosaik's UI (components, styles, the
 *    frame, `@mosaik/web-sdk`), so a team can bring its own, and `examples/links` shows it: it uses
 *    only `@mosaik/sdk`, with a page of its own.
 */
import { dirname, relative, resolve, sep } from "node:path"
import { Glob } from "bun"
import { ROOT } from "./workspace"

/** A package's entry points by name: `@mosaik/sdk`, `@mosaik/sdk/server`, ... */
const entryPoints = async (dir: string, name: string) =>
  Object.keys(
    ((await Bun.file(resolve(ROOT, dir, "package.json")).json()) as { exports: Record<string, string> }).exports,
  ).map((entry) => (entry === "." ? name : `${name}/${entry.slice(2)}`))

/** What apps may import of Mosaik: the SDK's two packages and their entry points. */
const SDK_ENTRY_POINTS: ReadonlySet<string> = new Set([
  ...(await entryPoints("packages/sdk", "@mosaik/sdk")),
  ...(await entryPoints("packages/web-sdk", "@mosaik/web-sdk")),
])

interface Rule {
  readonly name: string
  readonly files: (path: string) => boolean
  readonly forbidden: (specifier: string, file: string) => boolean
}

const SERVER_ONLY = [
  /^@mosaik\/(server|db)(\/|$)/,
  // Connectors are server-only, except their isomorphic data models (e.g. `@mosaik/connectors/jira/model`).
  /^@mosaik\/connectors(?!\/[^/]+\/model$)/,
  /^@mosaik\/auth\/server$/,
  /^@mosaik\/platform\/server$/,
  // The SDK's server and build entry points; a connector's data model is isomorphic.
  /^@mosaik\/(web-)?sdk\/(server|build\/.+)$/,
  /^@mosaik\/(app-kit|web-build)(\/|$)/,
  /^@mosaik\/sdk\/connectors(?!\/[^/]+\/model$)(\/|$)/,
  /^@mosaik\/portal\/build(\/|$)/,
  // Tests only (see the rule below); they run on the server side.
  /^@mosaik\/(sdk\/)?testing$/,
  /^@effect\/(sql-pg|platform-bun)/,
  /^effect\/sql/,
  /^bun$/,
  /^node:/,
  /^pg$/,
  /^better-auth/,
]
const BROWSER_ONLY = [
  /^solid-js/,
  /^@mosaik\/(table|charts|web-kit|frame|styled-system)(\/|$)/,
  /^@mosaik\/auth\/web$/,
  /^@mosaik\/portal\/web$/,
  // The component library, except its Panda preset (build time).
  /^@mosaik\/mosaik-ui(?!\/preset$)(\/|$)/,
  /^@mosaik\/sdk\/(client|solid|router)$/,
  /^@mosaik\/web-sdk\/(portal|ui|table|charts|css|jsx|patterns|tokens)$/,
  /^@tanstack\/solid-/,
  /^lucide-solid/,
  /^echarts/,
  /^@ark-ui\//,
]

const matchesAny = (patterns: ReadonlyArray<RegExp>, specifier: string) => patterns.some((p) => p.test(specifier))

/** Resolves a relative import to a workspace-relative path (e.g. `examples/sales/server/x`). */
const target = (specifier: string, file: string): string | null =>
  specifier.startsWith(".")
    ? relative(ROOT, resolve(dirname(resolve(ROOT, file)), specifier))
        .split(sep)
        .join("/")
    : null

/** Core's services; the shared packages (`packages/`, except the Portal's) and the console are Core's too. */
const CORE_SERVICES = ["auth", "notifications", "platform", "gateway", "mcp", "assistant"]

/** The SDK's modules that give apps the Portal: the only way from the SDK to it (rule 7). */
const SDK_PORTAL_MODULES: ReadonlySet<string> = new Set([
  "packages/web-sdk/src/portal.ts",
  "packages/web-sdk/src/build/vite.ts",
])

const isCore = (path: string) =>
  !SDK_PORTAL_MODULES.has(path) &&
  (CORE_SERVICES.some((service) => path.startsWith(`services/${service}/`)) ||
    path.startsWith("console/") ||
    (path.startsWith("packages/") && !path.startsWith("packages/portal/")))

const isPortal = (path: string) =>
  SDK_PORTAL_MODULES.has(path) ||
  path.startsWith("services/portal/") ||
  path.startsWith("packages/portal/") ||
  path.startsWith("shell/") ||
  path.startsWith("apps/")

const appOf = (path: string) => /^apps\/([^/]+)\//.exec(path)?.[1]
const exampleOf = (path: string) => /^examples\/([^/]+)\//.exec(path)?.[1]

const isBrowserCode = (path: string) =>
  /^(apps|examples)\/[^/]+\/web\//.test(path) ||
  /^packages\/(table|charts|web-kit|frame|client|console)\//.test(path) ||
  path.startsWith("packages/portal/src/web/") ||
  path.startsWith("packages/mosaik-ui/src/") ||
  path.startsWith("packages/auth/src/web/") ||
  path.startsWith("packages/assistant/src/web/") ||
  path.startsWith("shell/src/") ||
  path.startsWith("console/src/")

const isContract = (path: string) =>
  /^(apps|examples)\/[^/]+\/(manifest\.ts|api\/)/.test(path) ||
  /^packages\/connectors\/src\/[^/]+\/model\.ts$/.test(path) ||
  path.startsWith("packages/core/") ||
  path.startsWith("packages/portal/src/contract/") ||
  path.startsWith("packages/auth/src/contract/") ||
  path.startsWith("packages/assistant/src/contract/") ||
  path.startsWith("packages/notifications/src/contract/") ||
  path.startsWith("packages/platform/src/contract/")

const MOSAIK_UI = "packages/mosaik-ui/"

/** Behind the entry points of the SDK that a team with its own UI uses, which must stay free of ours. */
const isUiFree = (path: string) =>
  /^packages\/(sdk|core|db|auth|client|platform|notifications|connectors|server|testing|app-kit)\/src\//.test(path)

/** The example that brings its own UI, proving the SDK does not need ours. */
const OWN_UI_EXAMPLE = "examples/links/"

const UI = [
  /^@mosaik\/(mosaik-ui|styled-system|web-kit|frame|table|charts|portal|web-sdk|web-build)(\/|$)/,
  /^@ark-ui\//,
  /^lucide-solid/,
  /^echarts/,
]

const rules: ReadonlyArray<Rule> = [
  {
    name: "apps must not import other apps",
    files: (path) => path.startsWith("apps/"),
    forbidden: (specifier, file) => {
      const own = appOf(file)
      const pkg = /^@mosaik\/builtin-([^/]+)/.exec(specifier)?.[1]
      if (pkg !== undefined) return pkg !== own
      const resolved = target(specifier, file)
      return resolved !== null && appOf(`${resolved}/`) !== own
    },
  },
  {
    name: "browser code must not import server-only modules",
    files: isBrowserCode,
    forbidden: (specifier, file) =>
      matchesAny(SERVER_ONLY, specifier) || /\/server(\/|$)/.test(target(specifier, file) ?? ""),
  },
  {
    name: "contracts (manifest, api, core) must be isomorphic",
    files: isContract,
    forbidden: (specifier, file) =>
      matchesAny(SERVER_ONLY, specifier) ||
      matchesAny(BROWSER_ONLY, specifier) ||
      /\/(server|web)(\/|$)/.test(target(specifier, file) ?? ""),
  },
  {
    name: "app servers must not import browser code",
    files: (path) => /^(apps|examples)\/[^/]+\/server\//.test(path),
    forbidden: (specifier, file) =>
      matchesAny(BROWSER_ONLY, specifier) || /\/web(\/|$)/.test(target(specifier, file) ?? ""),
  },
  {
    name: "shared packages must not depend on apps",
    files: (path) => path.startsWith("packages/"),
    forbidden: (specifier, file) =>
      /^@mosaik\/(builtin|example)-/.test(specifier) || /^(apps|examples)\//.test(target(specifier, file) ?? ""),
  },
  {
    // An example shows what a team's app can do: it sees the SDK, the components and its own files.
    name: "examples use only the SDK and the component library",
    files: (path) => path.startsWith("examples/"),
    forbidden: (specifier, file) => {
      if (specifier.startsWith("@mosaik/")) return !SDK_ENTRY_POINTS.has(specifier) && specifier !== "@mosaik/mosaik-ui"
      const resolved = target(specifier, file)
      return resolved !== null && exampleOf(`${resolved}/`) !== exampleOf(file)
    },
  },
  {
    name: "the testing kit is for tests",
    files: (path) =>
      !/\.test\.tsx?$/.test(path) && !path.startsWith("packages/testing/") && path !== "packages/sdk/src/testing.ts",
    forbidden: (specifier) => /^@mosaik\/(sdk\/)?testing$/.test(specifier),
  },
  // Core and the Portal, in both directions: what keeps Core usable without the Portal.
  {
    name: "@mosaik/mosaik-ui must stand alone",
    files: (path) => path.startsWith(MOSAIK_UI),
    forbidden: (specifier, file) => {
      if (specifier.startsWith("@mosaik/")) return !/^@mosaik\/mosaik-ui(\/|$)/.test(specifier)
      const resolved = target(specifier, file)
      return resolved !== null && !`${resolved}/`.startsWith(MOSAIK_UI)
    },
  },
  {
    name: "@mosaik/sdk must import none of Mosaik's UI",
    files: isUiFree,
    forbidden: (specifier) => matchesAny(UI, specifier),
  },
  {
    name: "an app with its own UI uses none of Mosaik's",
    files: (path) => path.startsWith(OWN_UI_EXAMPLE),
    forbidden: (specifier) =>
      /^@mosaik\/sdk\/(solid|router)$/.test(specifier) || /^solid-js/.test(specifier) || matchesAny(UI, specifier),
  },
  {
    name: "Core must not depend on the Portal",
    files: isCore,
    forbidden: (specifier, file) =>
      /^@mosaik\/(portal|portal-service|shell|builtin-[^/]+)(\/|$)/.test(specifier) ||
      isPortal(`${target(specifier, file) ?? "-"}/`),
  },
  {
    name: "the Portal uses Core only through its contracts and the SDK",
    files: isPortal,
    forbidden: (specifier, file) => {
      if (/^@mosaik\/(auth|notifications|platform|gateway)-service(\/|$)/.test(specifier)) return true
      const resolved = target(specifier, file)
      return resolved !== null && CORE_SERVICES.some((service) => `${resolved}/`.startsWith(`services/${service}/`))
    },
  },
]

const transpilers = { ts: new Bun.Transpiler({ loader: "ts" }), tsx: new Bun.Transpiler({ loader: "tsx" }) }
const violations: Array<string> = []

for (const pattern of [
  "services/*/src/**/*.{ts,tsx}",
  "shell/src/**/*.{ts,tsx}",
  "console/src/**/*.{ts,tsx}",
  "packages/*/src/**/*.{ts,tsx}",
  "packages/mosaik-ui/{catalog,test,scripts,verify}/**/*.{ts,tsx,js}",
  "packages/mosaik-ui/*.config.ts",
  "apps/*/**/*.{ts,tsx}",
  "examples/*/**/*.{ts,tsx}",
]) {
  for await (const file of new Glob(pattern).scan({ cwd: ROOT })) {
    // Generated or built: an app's Panda runtime, its bundle.
    if (/(^|\/)(node_modules|styled-system|dist)\//.test(file) || file.endsWith(".gen.ts")) continue
    const applicable = rules.filter((rule) => rule.files(file))
    if (applicable.length === 0) continue
    const transpiler = file.endsWith(".tsx") ? transpilers.tsx : transpilers.ts
    const { imports } = transpiler.scan(await Bun.file(resolve(ROOT, file)).text())
    for (const { path: specifier } of imports) {
      for (const rule of applicable) {
        if (rule.forbidden(specifier, file)) violations.push(`${file}: "${specifier}" (${rule.name})`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`Boundary violations:\n${violations.map((v) => `  ${v}`).join("\n")}`)
  process.exit(1)
}
console.log("Boundaries OK")
