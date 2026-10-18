/**
 * Scaffolds a built-in app in `apps/<id>`, part of the platform and shipped with its image
 * (`bun create:app <id> --builtin`, see `create-app.ts`).
 */
import { mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { type BuiltinAppTemplate, files } from "./templates/builtin-app"
import { APPS_DIR, ROOT } from "./workspace"

export const createBuiltinApp = async (template: BuiltinAppTemplate): Promise<void> => {
  const { id } = template
  const dir = join(APPS_DIR, id)
  if (await Bun.file(join(dir, "manifest.ts")).exists()) {
    console.error(`apps/${id} already exists`)
    process.exit(1)
  }

  for (const [path, content] of Object.entries(files(template))) {
    await mkdir(dirname(join(dir, path)), { recursive: true })
    await Bun.write(join(dir, path), content)
  }

  // The shell bundles every built-in app's web code.
  const shellPackage = join(ROOT, "shell/package.json")
  const shell = await Bun.file(shellPackage).json()
  shell.dependencies[`@mosaik/builtin-${id}`] = "workspace:*"
  shell.dependencies = Object.fromEntries(Object.entries(shell.dependencies).sort(([a], [b]) => a.localeCompare(b)))
  await Bun.write(shellPackage, `${JSON.stringify(shell, null, 2)}\n`)

  await Bun.spawn(["bun", "install"], { cwd: ROOT, stdout: "inherit", stderr: "inherit" }).exited

  console.log(`
Created apps/${id}

  manifest.ts       id, permissions, roles${template.database ? ", database" : ""}
  api/              HttpApi contract shared by server and web
  server/           backend (Bun + Effect)
  web/routes/       pages, mounted at /${id}

Run it:  bun dev

For docker compose, add to infra/compose.yml:

  ${id}:
    <<: *service
    command: ["bun", "apps/${id}/server/main.ts"]

plus ${id}=http://${id}:3000 in CONFIGURED_APPS (platform service) and in MOSAIK_SERVICES.
`)
}
