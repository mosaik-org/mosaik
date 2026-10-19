/**
 * `bun dev [--headless] [app...]` — provisions databases and runs the whole platform locally:
 * Core's services, the Portal, built-in apps' backends, the examples, the gateway and Vite,
 * with prefixed, colored logs. Pass app ids to run only those apps (the rest of the
 * platform always runs). `--headless` runs Core alone, with the standalone examples.
 */
import { watch } from "node:fs"
import type { Subprocess } from "bun"
import { provisionAll } from "./db-provision"
import { planServices, type ServicePlan } from "./env"
import { discoverApps, discoverExamples, ROOT } from "./workspace"

const COLORS = [36, 35, 33, 32, 34, 91, 96, 95, 93, 92]
const paint = (code: number, text: string) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text)

const pipe = async (stream: ReadableStream<Uint8Array>, prefix: string, sink: NodeJS.WriteStream) => {
  const decoder = new TextDecoder()
  let buffer = ""
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) sink.write(`${prefix} ${line}\n`)
  }
  if (buffer) sink.write(`${prefix} ${buffer}\n`)
}

const start = (plan: ServicePlan, index: number, width: number): Subprocess => {
  const prefix = paint(COLORS[index % COLORS.length] ?? 37, plan.name.padEnd(width))
  const child = Bun.spawn([...plan.cmd], {
    cwd: plan.cwd,
    env: { ...process.env, ...plan.env, FORCE_COLOR: "1" },
    stdout: "pipe",
    stderr: "pipe",
  })
  void pipe(child.stdout, prefix, process.stdout)
  void pipe(child.stderr, prefix, process.stderr)
  void child.exited.then(async (code) => {
    if (shuttingDown) return
    // `bun --watch` stops watching once the process exits (e.g. a startup error).
    console.log(`${prefix} exited with code ${code}; restarting on the next source change`)
    await nextSourceChange()
    if (!shuttingDown) children[index] = start(plan, index, width)
  })
  return child
}

const nextSourceChange = () =>
  new Promise<void>((resolve) => {
    const watcher = watch(ROOT, { recursive: true }, (_, file) => {
      if (file && /\.(ts|tsx)$/.test(file) && !file.includes("node_modules") && !file.endsWith(".gen.ts")) {
        watcher.close()
        resolve()
      }
    })
  })

let shuttingDown = false
const children: Array<Subprocess> = []

const main = async () => {
  const args = process.argv.slice(2)
  const headless = args.includes("--headless")
  const only = new Set(args.filter((arg) => !arg.startsWith("--")))
  const chosen = (app: { readonly manifest: { readonly id: string } }) => only.size === 0 || only.has(app.manifest.id)
  const apps = (await discoverApps()).filter(chosen)
  const examples = (await discoverExamples()).filter(chosen)

  console.log("Provisioning databases...")
  try {
    await provisionAll({ examples: true })
  } catch (error) {
    console.error("Could not reach Postgres. Start local infrastructure with `bun infra:up`.\n", error)
    process.exit(1)
  }

  const plans = planServices(ROOT, apps, examples, { headless })
  const width = Math.max(...plans.map((p) => p.name.length))
  plans.forEach((plan, index) => {
    children[index] = start(plan, index, width)
  })

  const web = plans.find((plan) => plan.name === "web" || plan.name === "console")
  console.log(
    `\n  ${headless ? "Console" : "App    "}  http://localhost:${web?.port}${headless ? " (Core without the Portal)" : ""}`,
  )
  for (const example of examples.filter((example) => example.standalone)) {
    const plan = plans.find((candidate) => candidate.name === example.manifest.id)
    if (plan !== undefined)
      console.log(`  ${example.manifest.name.padEnd(8)} http://localhost:${plan.port} (standalone)`)
  }
  console.log("  Traces   http://localhost:16686 (with OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318)\n")

  const shutdown = async () => {
    if (shuttingDown) return
    shuttingDown = true
    for (const child of children) child.kill("SIGTERM")
    await Promise.race([Promise.all(children.map((c) => c.exited)), Bun.sleep(5000)])
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

await main()
