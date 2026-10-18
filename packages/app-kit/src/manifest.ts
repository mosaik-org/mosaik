import { join } from "node:path"
import type { AnyApp } from "@mosaik/core"
import { AppManifest, toAppManifest, WebBundle } from "@mosaik/platform/contract"
import { Schema } from "effect"
import { WEB_BUNDLE_FILE } from "./shared"

export interface WriteManifestOptions {
  /** Where `mosaikApp()` built the browser bundle. Defaults to `dist/web`; a standalone app has no bundle. */
  readonly webDir?: string
  /** Defaults to `mosaik-app.json`, where the Portal reads it from an app's image. */
  readonly file?: string
}

/**
 * Writes the app's manifest as static JSON (`mosaik-app.json`), with its built browser bundle
 * when there is one. Run after the build; the Portal reads it from the app's image.
 *
 * @example
 * // scripts/manifest.ts
 * await writeAppManifest(app)
 */
export const writeAppManifest = async (app: AnyApp, options: WriteManifestOptions = {}): Promise<AppManifest> => {
  const bundleFile = Bun.file(join(options.webDir ?? "dist/web", WEB_BUNDLE_FILE))
  const web = (await bundleFile.exists()) ? Schema.decodeUnknownSync(WebBundle)(await bundleFile.json()) : null
  const manifest = toAppManifest(app, web)
  await Bun.write(
    options.file ?? "mosaik-app.json",
    `${JSON.stringify(Schema.encodeSync(AppManifest)(manifest), null, 2)}\n`,
  )
  return manifest
}
